"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";
import Button from "@/components/Button";

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      className="mt-2"
      loading={isPending}
      onClick={() => startTransition(() => logoutAction())}
    >
      Sair da conta
    </Button>
  );
}
