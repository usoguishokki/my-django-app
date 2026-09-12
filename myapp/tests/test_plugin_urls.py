import re
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urljoin, urlsplit

import sass
from django.template.loader import render_to_string
from django.test import RequestFactory, override_settings
from django.middleware.csrf import CsrfViewMiddleware
from django.http import HttpResponse
from django.views.static import serve
from sass_processor.processor import SassProcessor

from myapp.http.plugin_urls import relative_plugin_url, versioned_plugin_url
from myapp import views


class PluginUrlTests(TestCase):
    def test_nested_upstream_paths_preserve_arbitrary_browser_mount(self):
        for mount in ('http://133.222.52.74:8010/', 'https://host.example/plugins/nika/frame/', 'https://host.example/plugins/other/frame/'):
            for path in ('/', '/login/', '/home/', '/ai-chat/', '/card/work/', '/card/work'):
                for target in ('/static/img/Nika.png', '/login/', '/home/', '/ai-chat/', '/api/home-dashboard/overall/?x=1'):
                    with self.subTest(mount=mount, path=path, target=target):
                        actual = urljoin(mount + path.lstrip('/'), relative_plugin_url(target, path))
                        self.assertEqual(mount + target.lstrip('/'), actual)

    def test_external_urls_and_fragments_are_unchanged(self):
        for target in ('https://cdn.example/style.css', '//cdn.example/a', '#panel'):
            self.assertEqual(target, relative_plugin_url(target, '/nested/page/'))

    def test_versioned_chat_css_resolves_through_host_frame_and_is_current(self):
        rendered_url = versioned_plugin_url(
            '/static/css/pages/nagakusa_chat.css',
            '/ai-chat/',
            '1.2.3+asset',
        )
        self.assertEqual(
            '../static/css/pages/nagakusa_chat.css?v=1.2.3%2Basset',
            rendered_url,
        )
        self.assertNotEqual(
            rendered_url,
            versioned_plugin_url(
                '/static/css/pages/nagakusa_chat.css',
                '/ai-chat/',
                '1.2.4',
            ),
        )
        self.assertEqual(
            'https://host.example/plugins/nika/frame/static/css/pages/nagakusa_chat.css?v=1.2.3%2Basset',
            urljoin('https://host.example/plugins/nika/frame/ai-chat/', rendered_url),
        )

        static_root = Path(__file__).parents[1] / 'static'
        response = serve(
            RequestFactory().get(rendered_url),
            'css/pages/nagakusa_chat.css',
            document_root=static_root,
        )
        self.assertEqual(200, response.status_code)
        css = b''.join(response.streaming_content).decode('utf-8')
        child_rule = re.search(r'\.child-grid\s*\{([^}]+)\}', css)
        self.assertIsNotNone(child_rule)
        self.assertIn('overflow-x: hidden', child_rule.group(1))
        self.assertIn('overflow-y: auto', child_rule.group(1))

    def test_rendered_assets_navigation_and_form_stay_within_frame(self):
        pages = {'login.html': '/login/', 'home/home_dashboard.html': '/home/', 'nagakusa/chat.html': '/ai-chat/'}
        for template, path in pages.items():
            request = RequestFactory().get(path)
            context = {'request': request, 'csrf_token': 'test-csrf-value', 'nagakusa_host_plugin_url': 'https://host.example/plugins/nika/'}
            with patch.dict('os.environ', {'NAGAKUSA_PLUGIN_VERSION': '1.2.3'}), patch.object(SassProcessor, 'processor_enabled', False):
                html = render_to_string(template, context)
            self.assertNotRegex(html, r'(?:src|href|action)="/static/')
            for mount in ('http://133.222.52.74:8010/', 'https://host.example/plugins/nika/frame/'):
                for url in re.findall(r'(?:src|href|action)="([^"]+)"', html):
                    if url.startswith(('https://', '#')):
                        continue
                    resolved = urljoin(mount + path.lstrip('/'), url)
                    self.assertTrue(resolved.startswith(mount), (template, url, resolved))
                    if '/static/' in resolved:
                        self.assertEqual('v=1.2.3', urlsplit(resolved).query)
                        relative_asset = urlsplit(resolved).path.split('/static/', 1)[1]
                        self.assertTrue((Path('myapp/static') / relative_asset).is_file(), relative_asset)
            if template == 'login.html':
                self.assertIn('action="../login/"', html)
                self.assertIn('name="csrfmiddlewaretoken"', html)
                self.assertNotRegex(html, r'<script\s*>')
                self.assertIn('static/js/login.js', html)
            else:
                self.assertIn('href="../ai-chat/"', html)
                self.assertEqual(1, html.count('static/js/header/header.js'))

    def test_login_success_redirect_and_session_assignment_without_database(self):
        request = RequestFactory().post('/login/', {'login_number': '123'})
        request.user = SimpleNamespace(is_authenticated=False)
        request.session = {}
        form = SimpleNamespace(is_valid=lambda: True, cleaned_data={'login_number': '123'})
        user = object()
        with patch.object(views, 'LoginForm', return_value=form), patch.object(views.MemberAuthenticationBackend, 'authenticate', return_value=user), patch.object(views, 'login') as login:
            response = views.login_view(request)
        login.assert_called_once_with(request, user)
        self.assertEqual('123', request.session['login_number'])
        self.assertEqual('../home/', response['Location'])

    @override_settings(ALLOWED_HOSTS=['testserver'])
    def test_csrf_and_chat_authentication_are_still_required(self):
        request = RequestFactory().post('/login/')
        rejected = CsrfViewMiddleware(lambda request: HttpResponse()).process_view(request, views.login_view, (), {})
        self.assertEqual(403, rejected.status_code)
        request = RequestFactory().get('/ai-chat/')
        request.user = SimpleNamespace(is_authenticated=False)
        self.assertEqual(302, views.nagakusa_ai_chat_view(request).status_code)

    def test_home_sass_embedded_image_is_relative_to_css(self):
        css = sass.compile(filename='myapp/static/css/pages/home_dashboard.scss', include_paths=['myapp/static/css'])
        self.assertNotIn('/static/', css)
        self.assertIn('../../img/arrow.svg', css)
