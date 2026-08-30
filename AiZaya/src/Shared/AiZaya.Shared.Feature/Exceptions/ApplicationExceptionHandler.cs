using AiZaya.Shared.Feature.OpenApi.Models;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace AiZaya.Shared.Feature.Exceptions;

internal sealed class AiZayaExceptionHandler(
    ILogger<AiZayaExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Произошло необработанное исключение");

        var openApiModel500InternalServerError = new ResponseInternalServerError
        {
            Status = StatusCodes.Status500InternalServerError,
            Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1",
            Title = "Ошибка сервера"
        };

        httpContext.Response.StatusCode = openApiModel500InternalServerError.Status;

        await httpContext.Response.WriteAsJsonAsync(openApiModel500InternalServerError, cancellationToken);

        return true;
    }
}
