using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AiZaya.Shared.Feature.OpenApi.Models;

[Description("Internal Server Error")]
[Title(nameof(InternalServerError))]
public class ResponseInternalServerError
{
    [Description("Ссылка на URI [RFC9110], идентифицирующая тип проблемы")]
    [Order(1)]
    public string Type { get; set; } = string.Empty;

    [Description("Краткое описание типа проблемы")]
    [Order(2)]
    public string Title { get; set; } = string.Empty;

    [Description("Код состояния HTTP [RFC9110]")]
    [Order(3)]
    public int Status { get; set; } = 500;

    [Description("Описание проблемы")]
    [Order(4)]
    public string? Detail { get; set; } = null;
}
