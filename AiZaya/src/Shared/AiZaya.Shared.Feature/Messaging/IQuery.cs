using AiZaya.Shared.Domain.Results;
using MediatR;

namespace AiZaya.Shared.Feature.Messaging;

public interface IQuery<TResponse> : IRequest<Result<TResponse>>;
