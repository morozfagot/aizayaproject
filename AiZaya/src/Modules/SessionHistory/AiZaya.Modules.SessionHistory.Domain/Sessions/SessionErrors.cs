using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Sessions;

public static class SessionErrors
{
    private const string Prefix = nameof(Session);

    public static Error NotFound(SessionId sessionId) =>
        Error.NotFound(
            $"{Prefix}.{nameof(Error.NotFound)}",
            $"Сессия {sessionId} не найдена");

    public static readonly Error InvalidWorkspacePath =
        Rule.CreateError(nameof(WorkspacePath), "WorkspacePath должен быть указан");
}
