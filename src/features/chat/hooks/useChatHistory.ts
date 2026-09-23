import { useQuery } from "@tanstack/react-query";
import { loadLatestChat } from "../api";

export function useChatHistory(collectionId: string) {
  return useQuery({
    queryKey: ["chat-history", collectionId],
    queryFn: () => loadLatestChat(collectionId),
    staleTime: 30_000,
  });
}
