import type { MessageReactionSummary } from "@/types/chat";

export const REACTION_HOVER_DELAY_MS = 1200;

interface ReactionBarVisibilityState {
  isReactionBarOpen: boolean;
  isReactionHoverVisible: boolean;
}

/**
 * Purpose:
 * Creates a stable signature for message reaction summaries.
 *
 * How it works:
 * It sorts reactions and reaction user IDs so equivalent reaction data produces
 * the same string even if array order changes.
 *
 * Parameters:
 * - reactions: Reaction summaries attached to the message.
 *
 * Returns:
 * A compact string representing the current reaction state.
 */
export function getReactionSignature(
  reactions: MessageReactionSummary[],
): string {
  return reactions
    .map((reaction) => {
      const userIds = reaction.users
        .map((user) => user._id)
        .sort()
        .join(",");

      return `${reaction.emoji}:${reaction.count}:${reaction.reactedByMe}:${userIds}`;
    })
    .sort()
    .join("|");
}

/**
 * Purpose:
 * Chooses which emoji should appear in the reaction animation.
 *
 * How it works:
 * It prefers an emoji whose count increased, then an emoji newly marked as the
 * current user's reaction, then falls back to the highest available reaction.
 *
 * Parameters:
 * - previous: Previous reaction summaries before the update.
 * - next: Current reaction summaries after the update.
 *
 * Returns:
 * The emoji to animate, or null when no reaction remains.
 */
export function getReactionAnimationEmoji(
  previous: MessageReactionSummary[],
  next: MessageReactionSummary[],
): string | null {
  const previousByEmoji = new Map(
    previous.map((reaction) => [reaction.emoji, reaction]),
  );
  const nextByCount = [...next].sort((a, b) => b.count - a.count);
  const increasedReaction = nextByCount.find(
    (reaction) =>
      reaction.count > (previousByEmoji.get(reaction.emoji)?.count ?? 0),
  );

  if (increasedReaction) {
    return increasedReaction.emoji;
  }

  const newOwnReaction = nextByCount.find(
    (reaction) =>
      reaction.reactedByMe && !previousByEmoji.get(reaction.emoji)?.reactedByMe,
  );

  return newOwnReaction?.emoji ?? nextByCount[0]?.emoji ?? null;
}

/**
 * Purpose:
 * Determines whether the quick reaction bar should be visible.
 *
 * How it works:
 * It treats explicit openings, such as mobile long-press, and completed hover
 * delays as equivalent reasons to show the bar.
 *
 * Parameters:
 * - state: Current explicit-open and delayed-hover visibility flags.
 *
 * Returns:
 * true when the quick reaction bar should be rendered as visible.
 */
export function getReactionBarVisibility(
  state: ReactionBarVisibilityState,
): boolean {
  return state.isReactionBarOpen || state.isReactionHoverVisible;
}
