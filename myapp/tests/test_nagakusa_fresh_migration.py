import io
import json
import os
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import RequestFactory

from myapp.api.nagakusa import nagakusa_plugin_manifest
from myapp.management.commands import register_nagakusa_plugin as registration
from myapp.nagakusa import bounded_http, config, http_client, platform_spec
from myapp.nagakusa.ai_prompt import build_ai_help
from myapp.nagakusa.manifest import build_manifest


IDENTITY = {
    'NAGAKUSA_PLUGIN_KEY': 'nika',
    'NAGAKUSA_PLUGIN_APP_KEY': 'nika',
    'NAGAKUSA_PLUGIN_MODULE_SLUG': 'nika',
    'NAGAKUSA_PLUGIN_LABEL': 'Nika',
    'NAGAKUSA_PLUGIN_VERSION': '0.1.0',
    'NAGAKUSA_RUNTIME_BASE_URL': 'http://133.222.52.74:8011/',
    'NAGAKUSA_BASE_URL': 'https://host.example/',
    'NAGAKUSA_REGISTRATION_API_URL': 'https://host.example/api/pluginhub/register/',
    'NAGAKUSA_REGISTRATION_KEY': 'fictional-registration-credential',
    'NAGAKUSA_PLUGIN_AI_API_TOKEN': 'fictional-ai-credential-not-a-real-token',
    'NAGAKUSA_PLUGIN_AI_ENABLED': '0',
    'NAGAKUSA_PLUGIN_AI_AGENT_MODE': 'host',
}


class FreshNikaContractTests(TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, IDENTITY, clear=True)
        environment.start()
        self.addCleanup(environment.stop)

    def test_runtime_endpoints_do_not_initialize_business_caches(self):
        from myapp.middlewares import ModelCacheMiddleware

        for path in ('/.well-known/nagakusa-plugin.json', '/api/health'):
            with self.subTest(path=path), patch('myapp.middlewares.CacheManager') as manager, patch('myapp.middlewares.CacheManagerIF') as interface:
                from django.urls import resolve
                request = RequestFactory().get(path)
                request.user = SimpleNamespace(is_authenticated=False)
                middleware = ModelCacheMiddleware(resolve(path).func)
                self.assertEqual(200, middleware(request).status_code)
                manager.assert_not_called()
                interface.assert_not_called()
                request.cache_manager_if.get_week_information()
                interface.assert_called_once_with(request.cache_manager)

    def test_runtime_manifest_and_help_identify_nika_without_enabling_tools(self):
        response = nagakusa_plugin_manifest(RequestFactory().get('/.well-known/nagakusa-plugin.json'))
        self.assertEqual(200, response.status_code)
        manifest = json.loads(response.content)
        self.assertEqual({
            'key': 'nika', 'app_key': 'nika', 'label': 'Nika', 'version': '0.1.0',
            'owner': 'your-team', 'summary': 'Nika 用のNagakusa DX System外部プラグインです。',
        }, manifest['plugin'])
        self.assertEqual({
            'category_key': 'development', 'icon': 'img/work_history_icon.svg',
            'default_screen_key': 'nika_home',
            'host_shell': {'appbar': True, 'launchbar': True, 'ai_dock': True},
        }, manifest['ui'])
        from django.contrib.staticfiles import finders
        self.assertIsNotNone(finders.find(manifest['ui']['icon']))
        self.assertEqual({
            'route': 'direct', 'delivery_mode': 'production_direct',
            'artifact_kind': 'plugin_version', 'artifact_ref': '0.1.0', 'change_ids': [],
        }, manifest['feedback_delivery'])
        self.assertEqual([], manifest['data_sources'])
        self.assertEqual('nika', manifest['runtime']['module_slug'])
        self.assertEqual('http://133.222.52.74:8011/', manifest['runtime']['base_url'])
        self.assertEqual('/', manifest['runtime']['launch_path'])
        self.assertEqual({'ai': False, 'desktop': True, 'standalone': True, 'rag_ingest': False}, manifest['features'])
        self.assertEqual(['ai.message.send'], [item['scope'] for item in manifest['host_permissions']])
        self.assertEqual([], manifest['tools'])
        help_spec = build_ai_help()
        self.assertEqual('nika', help_spec['app_key'])
        self.assertTrue(help_spec['assistant_instructions'])
        for key in ('NAGAKUSA_PLUGIN_AI_API_TOKEN', 'NAGAKUSA_REGISTRATION_KEY'):
            self.assertNotIn(IDENTITY[key], json.dumps([manifest, help_spec]))

    def test_chat_permission_is_independent_of_tool_feature_flag(self):
        for mode in ('disabled', 'host'):
            for enabled in ('0', '1'):
                with self.subTest(mode=mode, enabled=enabled), patch.dict(os.environ, {
                    'NAGAKUSA_PLUGIN_AI_AGENT_MODE': mode, 'NAGAKUSA_PLUGIN_AI_ENABLED': enabled,
                }):
                    manifest = build_manifest()
                    self.assertEqual(enabled == '1', manifest['features']['ai'])
                    self.assertEqual(mode == 'host', bool(manifest['host_permissions']))
        with patch.dict(os.environ, {'NAGAKUSA_PLUGIN_AI_AGENT_MODE': 'local'}):
            with self.assertRaises(config.NagakusaConfigurationError):
                build_manifest()

    def test_host_entry_uses_configured_module_and_runtime_normalizes_base(self):
        self.assertEqual('https://host.example/plugins/nika/', config.host_plugin_url())
        with patch.dict(os.environ, {'NAGAKUSA_PLUGIN_MODULE_SLUG': 'another-plugin'}):
            self.assertEqual('https://host.example/plugins/another-plugin/', config.host_plugin_url())
        with patch.dict(os.environ, {'NAGAKUSA_RUNTIME_BASE_URL': 'http://133.222.52.74:8011'}):
            self.assertEqual('http://133.222.52.74:8011/', config.get_runtime_configuration().base_url)

    def test_active_source_does_not_target_old_host_entry(self):
        root = Path(__file__).resolve().parents[2]
        for directory in ('myapp/nagakusa', 'myapp/static/js', 'myapp/templates', 'myapp/management'):
            for path in (root / directory).rglob('*'):
                if path.suffix in {'.py', '.js', '.html'}:
                    self.assertNotIn('/plugins/hozen/', path.read_text(encoding='utf-8'), str(path))

    def test_official_channel_shape_is_accepted_and_legacy_shape_rejected(self):
        platform_spec._validate_spec({'channel': {'version': 25}, 'contracts': {}})
        for payload in ({'metadata': {'version': 1}, 'contracts': {}}, {'channel': {'version': True}, 'contracts': {}}):
            with self.assertRaises(RuntimeError):
                platform_spec._validate_spec(payload)

    def test_registration_dry_run_has_no_network_state_write_or_secret_digest(self):
        output = io.StringIO()
        with patch.object(registration, 'post_json') as post, patch.object(registration, '_save_state') as save:
            call_command('register_nagakusa_plugin', '--dry-run', stdout=output)
        post.assert_not_called()
        save.assert_not_called()
        self.assertNotIn('fingerprint', output.getvalue())
        self.assertNotIn(IDENTITY['NAGAKUSA_REGISTRATION_KEY'], output.getvalue())
        self.assertNotIn(IDENTITY['NAGAKUSA_PLUGIN_AI_API_TOKEN'], output.getvalue())

    def test_registration_payload_matches_starter_and_preserves_endpoint_slash(self):
        # This command's transport is mocked: no registration POST is performed.
        with patch.object(registration, 'post_json', return_value=SimpleNamespace(status=200, payload={
            'ok': True, 'plugin': {'module_slug': 'nika'}, 'next': {'open_url': '/plugins/nika/'},
        })) as post, patch.object(registration, '_load_state', return_value={}), patch.object(registration, '_save_state') as save:
            call_command('register_nagakusa_plugin', stdout=io.StringIO())
        args = post.call_args.kwargs
        self.assertEqual(IDENTITY['NAGAKUSA_REGISTRATION_API_URL'], args['url'])
        self.assertEqual({'registration_key', 'base_url', 'manifest_url', 'manifest', 'api_token'}, set(args['payload']))
        self.assertEqual(IDENTITY['NAGAKUSA_REGISTRATION_KEY'], args['payload']['registration_key'])
        self.assertEqual(IDENTITY['NAGAKUSA_PLUGIN_AI_API_TOKEN'], args['payload']['api_token'])
        self.assertEqual(IDENTITY['NAGAKUSA_RUNTIME_BASE_URL'] + '.well-known/nagakusa-plugin.json', args['payload']['manifest_url'])
        self.assertEqual('success', save.call_args.args[0]['status'])

    def test_registration_rejects_foreign_origin_before_transport(self):
        with patch.dict(os.environ, {'NAGAKUSA_REGISTRATION_API_URL': 'https://foreign.example/register/'}), patch.object(registration, 'post_json') as post:
            with self.assertRaises(CommandError):
                call_command('register_nagakusa_plugin', '--dry-run', stdout=io.StringIO())
        post.assert_not_called()

    def test_registration_success_skip_rotation_and_failure_backoff(self):
        for field in ('api_token', 'registration_key'):
            self.assertNotEqual(registration._fingerprint('https://host.example/', {field: 'old'}), registration._fingerprint('https://host.example/', {field: 'new'}))
        with patch.object(registration, '_already_registered', return_value=True), patch.object(registration, 'post_json') as post:
            call_command('register_nagakusa_plugin', stdout=io.StringIO())
        post.assert_not_called()
        with patch.object(registration, '_load_state', return_value={}), patch.object(registration, 'post_json', side_effect=RuntimeError('private transport detail')), patch.object(registration, '_save_state') as save, patch.object(registration.time, 'time', return_value=1000):
            with self.assertRaises(CommandError) as error:
                call_command('register_nagakusa_plugin', stdout=io.StringIO())
        self.assertNotIn('private transport detail', str(error.exception))
        self.assertTrue(1060 <= save.call_args.args[0]['retry_after'] <= 1090)
        with patch.object(registration, '_load_state', return_value={'status': 'failed', 'fingerprint': 'test', 'retry_after': 'bad'}):
            self.assertFalse(registration._retry_after('test'))

    def test_transport_headers_and_sanitized_structured_error(self):
        secret = IDENTITY['NAGAKUSA_REGISTRATION_KEY']
        response = SimpleNamespace(status=409, body=json.dumps({'error': {'code': 'base_url_conflict', 'message': 'Rejected ' + secret}}).encode())
        with patch.object(http_client, 'request_bytes', return_value=response) as request:
            with self.assertRaises(http_client.RemoteHttpError) as error:
                http_client.post_json(url=IDENTITY['NAGAKUSA_REGISTRATION_API_URL'], payload={'registration_key': secret}, timeout_seconds=10)
        self.assertEqual('base_url_conflict', error.exception.code)
        self.assertNotIn(secret, str(error.exception))
        headers = dict(request.call_args.args[0].header_items())
        self.assertEqual('NagakusaPluginStarter/1', headers['User-agent'])
        self.assertEqual('identity', headers['Accept-encoding'])
        self.assertEqual('application/json', headers['Content-type'])

    def test_transport_rejects_all_redirects_without_second_request(self):
        import urllib.request
        for status in (301, 302, 303, 307, 308):
            connection = __import__('unittest.mock', fromlist=['Mock']).Mock()
            connection.getresponse.return_value.status = status
            with self.subTest(status=status), patch.object(bounded_http, '_resolve_addresses', return_value=[]), patch.object(bounded_http, '_open_resolved_connection', return_value=connection), patch.object(bounded_http, '_tighten_connection_timeout'):
                with self.assertRaisesRegex(RuntimeError, 'redirects are not allowed'):
                    bounded_http.request_bytes(urllib.request.Request('https://host.example/register/', data=b'{}'), timeout_seconds=10, max_response_bytes=1024)
            connection.request.assert_called_once()
            connection.close.assert_called_once()
