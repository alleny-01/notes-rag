import { useMutation } from "@tanstack/react-query";
import { sendChatMessage } from "../api";

export function useSendMessage() {
  return useMutation({ mutationFn: sendChatMessage });
}