using MediatR;
using Microsoft.Extensions.Logging;

namespace AiZaya.Shared.Feature.Behaviors;

internal sealed class ExceptionPipelineBehavior<TRequest, TResponse>(
    ILogger<ExceptionPipelineBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : class
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        try
        {
            return await next(cancellationToken);
        }
        catch (Exception exception)
        {
            var requestName = typeof(TRequest).Name;
            logger.LogError(exception, "Необработанное исключение для {RequestName}", requestName);
            throw new Exceptions.AiZayaException(requestName, innerException: exception);
        }
    }
}
