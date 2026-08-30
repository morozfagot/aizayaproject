using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;
using Microsoft.AspNetCore.Http.HttpResults;

namespace AiZaya.Shared.Feature.OpenApi.Models;

[Description("Bad Request")]
[Title(nameof(BadRequest))]
public class ResponseBadRequest : ResponseInternalServerError
{
    [Description("Ошибка запроса")]
    [Order(5)]
    public ResponseError Error => new();
}
