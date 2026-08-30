using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AiZaya.Shared.Feature.OpenApi.Models;

[Description(nameof(Conflict))]
[Title(nameof(Conflict))]
internal sealed class ResponseConflict : ResponseInternalServerError
{
    [Description("Список ошибок конфликта")]
    [Order(5)]
    public List<ResponseError> Errors => [];

    [Description("Идентификатор трассировки")]
    [Order(6)]
    public string TraceId => string.Empty;
}
