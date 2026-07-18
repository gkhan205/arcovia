import { confirm, isCancel } from "@clack/prompts";

/** Prompts the user to include an optional AI review. */
export async function promptForAiReview(): Promise<boolean> {
  const response = await confirm({
    initialValue: false,
    message: "Would you like an AI review?",
  });

  return isCancel(response) ? false : response;
}
