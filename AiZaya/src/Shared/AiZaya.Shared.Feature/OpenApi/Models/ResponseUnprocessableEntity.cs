using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AiZaya.Shared.Feature.OpenApi.Models;

[Description("Unprocessable Entity")]
[Title(nameof(UnprocessableEntity))]
public class ResponseUnprocessableEntity : ResponseInternalServerError
{
    [Description("Список ошибок в бизнес-правилах")]
    [Order(5)]
    public List<ResponseError> Errors => [];

    [Description("Идентификатор трассировки")]
    [Order(6)]
    public string TraceId => string.Empty;
}
