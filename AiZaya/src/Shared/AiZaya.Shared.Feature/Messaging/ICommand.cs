using AiZaya.Shared.Domain.Results;
using MediatR;

namespace AiZaya.Shared.Feature.Messaging;

public interface ICommand : IRequest<Result>, IBaseCommand;

public interface ICommand<TResponse> : IRequest<Result<TResponse>>, IBaseCommand;

public interface IBaseCommand;
