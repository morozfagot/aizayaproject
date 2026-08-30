using AiZaya.Shared.Domain.Results;
using MediatR;

namespace AiZaya.Shared.Feature.Messaging;

public interface IQueryHandler<in TQuery, TResponse> : IRequestHandler<TQuery, Result<TResponse>>
    where TQuery : IQuery<TResponse>;
