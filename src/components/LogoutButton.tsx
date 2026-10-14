"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/actions/auth";
import Button from "@/components/Button";
import Icon from "@/components/Icon";

export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      className="mt-4"
      loading={isPending}
      onClick={() => startTransition(() => logoutAction())}
    >
      <Icon name="logout" size={18} />
      Sair da conta
    </Button>
  );
}
