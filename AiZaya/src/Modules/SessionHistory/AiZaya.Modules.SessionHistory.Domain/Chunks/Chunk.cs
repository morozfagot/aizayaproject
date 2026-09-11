using System.Text.RegularExpressions;
using AiZaya.Modules.SessionHistory.Domain.Chunks.Events;
using AiZaya.Modules.SessionHistory.Domain.Messages;
using AiZaya.Modules.SessionHistory.Domain.Sessions;
using AiZaya.Shared.Domain.Abstractions;
using AiZaya.Shared.Domain.Results;

namespace AiZaya.Modules.SessionHistory.Domain.Chunks;

/// <summary>
/// Chunk — фрагмент сообщения для векторного поиска.
/// Хранит ТОЛЬКО текст фрагмента (Content) + метаданные. Immutable после создания.
/// Вектор эмбеддинга НЕ хранится: он transient, передаётся напрямую в Qdrant-хранилище
/// вместе с метаданными из чанка (не поле агрегата).
/// </summary>
/// <remarks>
/// Фильтрация шума — инвариант агрегата. Паттерны живут здесь как private static
/// и подбираются в <see cref="Create"/> в зависимости от <see cref="ChunkRole"/>.
/// Никаких доменных сервисов.
/// </remarks>
public sealed partial class Chunk : AggregateRoot<ChunkId>
{
    public SessionId SessionId { get; private set; } = null!;
    public Source Source { get; private set; } = null!;
    public MessageId MessageId { get; private set; } = null!;
    public ChunkIndex ChunkIndex { get; private set; } = null!;
    public string Content { get; private set; } = null!;
    public ChunkRole Role { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Chunk()
    {
    }

    public static Result<Chunk> Create(
        SessionId sessionId,
        Source source,
        MessageId messageId,
        ChunkIndex chunkIndex,
        string content,
        ChunkRole role)
    {
        var rule = Rule.CreateBuilder()
            .ErrorIf(nameof(SessionId), sessionId is null || string.IsNullOrWhiteSpace(sessionId.Value), "SessionId не может быть пустым")
            .ErrorIf(nameof(Source), source is null || string.IsNullOrWhiteSpace(source.Value), "Source должен быть валидным")
            .ErrorIf(nameof(MessageId), messageId is null || string.IsNullOrWhiteSpace(messageId.Value), "MessageId не может быть пустым")
            .ErrorIf(nameof(ChunkIndex), chunkIndex is null, "ChunkIndex должен быть указан")
            .ErrorIf(nameof(Chunk), string.IsNullOrWhiteSpace(content), "Content не может быть пустым")
            .ErrorIf(nameof(ChunkRole), !Enum.IsDefined(typeof(ChunkRole), (int)role), "ChunkRole должен быть валидным")
            .ErrorIf(nameof(Chunk), IsNoise(content, role), "Content является шумом и не может быть проиндексирован")
            .Build();

        if (rule.IsFailure)
        {
            return rule.Error;
        }

        var chunk = new Chunk
        {
            Id = ChunkId.Create(sessionId!, chunkIndex!)!.Value!,
            SessionId = sessionId!,
            Source = source!,
            MessageId = messageId!,
            ChunkIndex = chunkIndex!,
            Content = content,
            Role = role,
            CreatedAt = DateTime.UtcNow
        };

        chunk.Raise(new SessionChunkCreatedDomainEvent(
            chunk.SessionId.Value,
            chunk.ChunkIndex.Value,
            chunk.Source.Value,
            chunk.MessageId.Value,
            ComputeTextHash(chunk.Content),
            (int)chunk.Role,
            chunk.CreatedAt));

        return chunk;
    }

    private static string ComputeTextHash(string text)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text));
        return Convert.ToHexString(bytes);
    }

    /// <summary>
    /// Проверяет, является ли контент шумом (невалидным для индексации).
    /// Подбор паттернов зависит от роли чанка. Перенесено из morozcode isRrrNoiseChunk.
    /// </summary>
    private static bool IsNoise(string content, ChunkRole role)
    {
        var trimmed = content.Trim();

        // Короткие фрагменты — вероятно обрывки системного boilerplate.
        if (trimmed.Length < 5)
        {
            return true;
        }

        // Слишком длинные JSON/JSONL-логи (raw logs).
        if (trimmed.Length > 2000 && (trimmed.StartsWith('{') || trimmed.StartsWith('[')))
        {
            return true;
        }

        // Листинг каталога (tool output команды dir/list_files) — невалидный шум.
        if (LooksLikeDirectoryListing(trimmed))
        {
            return true;
        }

        var patterns = role switch
        {
            ChunkRole.ToolOutput => ToolOutputPatterns,
            _ => CommonPatterns
        };

        return patterns.Any(pattern => pattern.IsMatch(trimmed));
    }

    /// <summary>
    /// Паттерны листинга каталога (H90): строки вида "Directory of C:\..." либо
    /// перечисление директорий/файлов с пробелами (list_files вывод).
    /// </summary>
    private static bool LooksLikeDirectoryListing(string text)
    {
        return DirectoryListingPattern.IsMatch(text) || text.StartsWith("Directory of ");
    }

    /// <summary>
    /// Общие паттерны шума: system prompt boilerplate, environment_details, reminders,
    /// WS-search фрагменты, Preview, [Code Fragment N], служебные фразы ассистента.
    /// </summary>
    private static readonly IReadOnlyList<Regex> CommonPatterns =
    [
        new Regex(@"<system_prompt>[\s\S]*?</system_prompt>"),
        new Regex(@"<environment_details>[\s\S]*?</environment_details>"),
        new Regex(@"<slug>|</slug>|<name>|</name>|<model>|</model>"),
        new Regex(@"^={3,}$", RegexOptions.Multiline),
        new Regex(@"^MARKDOWN RULES$", RegexOptions.Multiline),
        new Regex(@"^ALL responses MUST show", RegexOptions.Multiline),
        new Regex(@"^You are STRICTLY FORBIDDEN", RegexOptions.Multiline),
        new Regex(@"^You should NOT be conversational", RegexOptions.Multiline),
        new Regex(@"^NEVER end attempt_completion", RegexOptions.Multiline),
        new Regex(@"^When presented with images", RegexOptions.Multiline),
        new Regex(@"^# Current Mode$", RegexOptions.Multiline),
        new Regex(@"^REMINDERS$", RegexOptions.Multiline),
        new Regex(@"^Below is your current list of reminders", RegexOptions.Multiline),
        new Regex(@"^VSCode Visible Files$", RegexOptions.Multiline),
        new Regex(@"^## (Current Working Directory|Environment Details|Current Time|Current Cost|Current Mode|Current Workspace Directory|File Context:|System-reminder|Mandatory Skill Check|Linked File Handling|Internal Verification|Context Notes|Available Skills|Capabilities|Modes|Rules|Next Steps)$", RegexOptions.Multiline),
        new Regex(@"^TOOL USE$", RegexOptions.Multiline),
        new Regex(@"^You have access to a set of tools", RegexOptions.Multiline),
        new Regex(@"^# Tool Use Guidelines$", RegexOptions.Multiline),
        new Regex(@"^(WS search|Workspace search|Search results?)\s*:"),
        new Regex(@"^File path: .+\n?Score: [0-9.]+$", RegexOptions.Multiline),
        new Regex(@"^Score: [0-9.]+$", RegexOptions.Multiline),
        new Regex(@"^Code Chunk: "),
        new Regex(@"^Task was interrupted before this tool call", RegexOptions.Multiline),
        new Regex(@"^Request to switch to a different mode$", RegexOptions.Multiline),
        new Regex(@"^Found \d+ results\.$", RegexOptions.Multiline),
        new Regex(@"^File: .+\nIMPORTANT: File content truncated", RegexOptions.Multiline),
        new Regex(@"^Error: ", RegexOptions.Multiline),
        new Regex(@"^Теперь у меня есть полный ответ", RegexOptions.Multiline),
        new Regex(@"^Ключевые данные:", RegexOptions.Multiline),
        new Regex(@"^Отвечаю на все вопросы", RegexOptions.Multiline),
        new Regex(@"^Итог для Code", RegexOptions.Multiline)
    ];

    /// <summary>
    /// Паттерны шума для tool_output: JSON статусы denied/approved/error, path/operation,
    /// read_file вывод с номерами строк, Preview, Directory of, [Code Fragment N], docker build.
    /// </summary>
    private static readonly IReadOnlyList<Regex> ToolOutputPatterns =
    [
        new Regex(@"^\{[^{}]*""status"":""(?:denied|approved|error)""", RegexOptions.Multiline),
        new Regex(@"^\{[^{}]*""path"":", RegexOptions.Multiline),
        new Regex(@"^\{[^{}]*""operation"":", RegexOptions.Multiline),
        new Regex(@"^File: .+\n\s*\d+\s*\| ", RegexOptions.Multiline),
        new Regex(@"^Preview:"),
        new Regex(@"^Directory of "),
        new Regex(@"^\[Code Fragment \d+\]", RegexOptions.Multiline),
        new Regex(@"^#\d+ \[build", RegexOptions.Multiline)
    ];

    private static readonly Regex DirectoryListingPattern = new(
        @"^(\s*(Directory|Directory Listing|Listing of)\s)|^(\s*[^\s]+\s+[-+]?\s*\d{1,3}%?\s+[A-Za-z0-9_.\-/\\]+$)",
        RegexOptions.Multiline);

    private IEnumerable<object> GetComparisonValues() => [Id];
}

public partial class Chunk : IEquatable<Chunk>
{
    public bool Equals(Chunk? other)
    {
        if (other is null) return false;
        return GetComparisonValues().SequenceEqual(other.GetComparisonValues());
    }

    public override bool Equals(object? obj) => obj is Chunk other && Equals(other);

    public override int GetHashCode() => Id.GetHashCode();

    public static bool operator ==(Chunk? left, Chunk? right)
    {
        if (left is null) return right is null;
        return left.Equals(right);
    }

    public static bool operator !=(Chunk? left, Chunk? right) => !(left == right);
}
