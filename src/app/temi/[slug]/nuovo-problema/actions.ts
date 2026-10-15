"use server";

import { redirect } from "next/navigation";
import { problemSchema } from "@/lib/content/schemas";
import { writeContent, type WriteState } from "@/lib/content/write";

export async function createProblem(_prev: WriteState, form: FormData): Promise<WriteState> {
  const result = await writeContent({
    schema: problemSchema,
    form,
    contentType: "problem",
    texts: (d) => [d.title, d.body, d.affected],
    rpc: (service, userId, d) =>
      service.rpc("create_problem", {
        user_id: userId,
        topic_id: d.topic_id,
        title: d.title,
        body: d.body,
        affected: d.affected,
      }),
  });
  if (result.ok && result.id) redirect(`/problemi/${result.id}?nuovo=1`);
  return result;
}
