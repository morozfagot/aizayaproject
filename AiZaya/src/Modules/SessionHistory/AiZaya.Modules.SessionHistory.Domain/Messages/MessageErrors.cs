using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Messages;

public static class MessageErrors
{
    private const string Prefix = nameof(Message);

    public static Error NotFound(MessageId messageId) =>
        Error.NotFound(
            $"{Prefix}.{nameof(Error.NotFound)}",
            $"Сообщение {messageId} не найдено");

    public static Error AlreadyIndexed(MessageId messageId, int dimension) =>
        Error.Conflict(
            $"{Prefix}.AlreadyIndexed",
            $"Сообщение {messageId} уже проиндексировано в размерности {dimension}");
}