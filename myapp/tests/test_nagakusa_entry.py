import os
from pathlib import Path
import re
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

import sass
from django.template.loader import render_to_string
from django.test import RequestFactory, override_settings

from myapp.context_processors import employee_infomation
from myapp.nagakusa.config import host_plugin_url


class NagakusaEntryTests(TestCase):
    def test_chat_page_main_region_is_the_single_vertical_scroll_owner(self):
        stylesheet = Path(__file__).parents[1] / 'static/css/pages/nagakusa_chat.scss'
        compiled = sass.compile(filename=str(stylesheet))
        child_rule = re.search(r'\.child-grid\s*\{([^}]+)\}', compiled)
        message_rule = re.search(r'\.nagakusa-chat__messages\s*\{([^}]+)\}', compiled)
        self.assertIsNotNone(child_rule)
        self.assertIn('overflow-x: hidden', child_rule.group(1))
        self.assertIn('overflow-y: auto', child_rule.group(1))
        self.assertIsNotNone(message_rule)
        self.assertNotIn('overflow-y', message_rule.group(1))

    @override_settings(SASS_PROCESSOR_ENABLED=False)
    def test_chat_stylesheet_is_rendered_after_base_and_before_noncompeting_header(self):
        request = RequestFactory().get('/ai-chat/')
        request.session = {}
        with patch.dict(os.environ, {'NAGAKUSA_PLUGIN_VERSION': '1.2.3'}), patch(
            'myapp.context_processors.build_employee_context',
            return_value={'employee': None},
        ):
            html = render_to_string(
                'nagakusa/chat.html',
                {'nagakusa_chat_enabled': True},
                request=request,
            )
        base = html.index('css/base.css')
        chat = html.index('css/pages/nagakusa_chat.css')
        header = html.index('css/header.css')
        self.assertLess(base, chat)
        self.assertLess(chat, header)
        self.assertIn('href="../static/css/pages/nagakusa_chat.css?v=1.2.3"', html)

    def test_known_default_and_configurable_public_url(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual('https://nagakusa-dx.toyota-shokki.co.jp/plugins/nika/', host_plugin_url())
        with patch.dict(os.environ, {'NAGAKUSA_HOST_PLUGIN_URL': 'https://host.example/plugins/nika/'}):
            self.assertEqual('https://host.example/plugins/nika/', host_plugin_url())

    def test_unsafe_or_credential_bearing_configuration_is_not_exposed(self):
        for value in ('', 'javascript:alert(1)', 'http://host.example/', 'https://user:password@host.example/', 'https://host.example/?token=private', 'https://host.example/#target', 'https://host.example/inside\npath'):
            with self.subTest(value=value), patch.dict(os.environ, {'NAGAKUSA_HOST_PLUGIN_URL': value}):
                self.assertEqual('', host_plugin_url())

    @override_settings(SASS_PROCESSOR_ENABLED=False)
    def test_rendered_header_has_local_fallback_and_only_public_configuration(self):
        sentinel = 'private-test-sentinel'
        with patch.dict(os.environ, {
            'NAGAKUSA_HOST_PLUGIN_URL': 'https://host.example/plugins/nika/',
            'NAGAKUSA_PLUGIN_AI_API_TOKEN': sentinel,
            'NAGAKUSA_REGISTRATION_KEY': sentinel,
        }), patch('myapp.context_processors.build_employee_context', return_value={'employee': None}):
            context = employee_infomation(SimpleNamespace(session={}))
            html = render_to_string('header.html', context)
        self.assertIn('href="./ai-chat/"', html)
        self.assertIn('data-host-plugin-url="https://host.example/plugins/nika/"', html)
        self.assertIn('js/nagakusa/entry.js', html)
        self.assertNotIn(sentinel, html)
        for asset in (Path(__file__).parents[1] / 'static/js/nagakusa').glob('*.js'):
            text = asset.read_text(encoding='utf-8')
            self.assertNotIn(sentinel, text)
            self.assertNotIn('NAGAKUSA_PLUGIN_AI_API_TOKEN', text)
            self.assertNotIn('NAGAKUSA_REGISTRATION_KEY', text)
