using AiZaya.Shared.Domain.Results;
using Microsoft.AspNetCore.Http;

namespace AiZaya.Shared.Feature.Results;

public static class ApiResults
{
    public static IResult Problem(Domain.Results.Interfaces.IResult result)
    {
        if (result.IsSuccess)
        {
            throw new InvalidOperationException();
        }

        var error = result.Error;
        var title = GetTitle(error);
        var detail = GetDetail(error);
        var type = GetType(error);
        var statusCode = GetStatusCode(error);
        var extensions = GetErrors(error);

        var response = Microsoft.AspNetCore.Http.Results.Problem(
            title: title,
            detail: detail,
            type: type,
            statusCode: statusCode,
            extensions: extensions);

        return response;
    }

    private static string GetTitle(Error error) =>
        error.Type switch
        {
            ErrorType.Failure => error.Code,
            ErrorType.NotFound => error.Code,
            ErrorType.Conflict => error.Code,
            ErrorType.Rule => error.Code,
            _ => "Ошибка сервера"
        };

    private static string GetDetail(Error error) =>
        error.Type switch
        {
            ErrorType.Failure => error.Description,
            ErrorType.NotFound => error.Description,
            ErrorType.Conflict => error.Description,
            ErrorType.Rule => error.Description,
            _ => "Произошла непредвиденная ошибка"
        };

    private static string GetType(Error error) =>
        error.Type switch
        {
            ErrorType.Failure => "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1",
            ErrorType.NotFound => "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5",
            ErrorType.Conflict => "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.10",
            ErrorType.Rule => "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21",
            _ => "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.1"
        };

    private static int GetStatusCode(Error error)
    {
        return error.Type switch
        {
            ErrorType.Failure => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Rule => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError
        };
    }

    private static Dictionary<string, object?> GetErrors(Error error)
    {
        if (error is RuleError ruleError)
        {
            return new Dictionary<string, object?>
            {
                ["errors"] = ruleError.Errors
            };
        }

        var result = new Dictionary<string, object?>
        {
            ["errors"] = error
        };

        return result;
    }
}
