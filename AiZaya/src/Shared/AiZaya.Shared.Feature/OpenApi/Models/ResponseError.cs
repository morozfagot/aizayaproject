using AiZaya.Shared.Domain.Results;
using AiZaya.Shared.Feature.OpenApi.Parsers.Attributes;

namespace AiZaya.Shared.Feature.OpenApi.Models;

[Description("Error")]
[Title("Error")]
public class ResponseError
{
    [Description("Код ошибки")]
    [Order(1)]
    public string Code => string.Empty;

    [Description("Описание ошибки")]
    [Order(2)]
    public string Description => string.Empty;

    [Description("Тип ошибки")]
    [EnumValueNumbers(typeof(ErrorType))]
    [Order(3)]
    public int Type => 0;

    [Description("Имя типа ошибки")]
    [EnumValueNames(typeof(ErrorType))]
    [Order(4)]
    public string TypeName => string.Empty;
}
