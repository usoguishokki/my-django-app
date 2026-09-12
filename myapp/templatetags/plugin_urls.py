from django import template
from django.template.defaulttags import url as django_url
from django.templatetags.static import static
from sass_processor.templatetags.sass_tags import SassSrcNode

from myapp.http.plugin_urls import relative_plugin_url, versioned_plugin_url
from myapp.nagakusa.config import plugin_version

register = template.Library()


def relative(context, target):
    request = context.get('request')
    return relative_plugin_url(target, request.path_info if request else '/')


def versioned_relative(context, target):
    request = context.get('request')
    return versioned_plugin_url(
        target,
        request.path_info if request else '/',
        plugin_version(),
    )


@register.simple_tag(takes_context=True)
def plugin_static(context, path):
    return versioned_relative(context, static(path))


class RelativeUrlNode(template.Node):
    def __init__(self, node):
        self.node = node

    def render(self, context):
        result = self.node.render(context)
        if self.node.asvar:
            context[self.node.asvar] = relative(context, context[self.node.asvar])
            return result
        return relative(context, result)


@register.tag
def plugin_url(parser, token):
    return RelativeUrlNode(django_url(parser, token))


class RelativeSassNode(template.Node):
    def __init__(self, node):
        self.node = node

    def render(self, context):
        # Keep the existing compilation/storage lifecycle; change only the URL.
        return versioned_relative(context, self.node.render(context))


@register.tag
def plugin_sass(parser, token):
    return RelativeSassNode(SassSrcNode.handle_token(parser, token))
