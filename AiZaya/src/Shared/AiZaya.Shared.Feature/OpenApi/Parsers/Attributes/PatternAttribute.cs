using System.Diagnostics.CodeAnalysis;

namespace AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

[AttributeUsage(AttributeTargets.Property)]
internal sealed class PatternAttribute([StringSyntax(StringSyntaxAttribute.Regex)] string pattern) : Attribute
{
    public string Pattern { get; } = pattern;
}
