"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

type NavigateOptions = {
  replace?: boolean;
  scroll?: boolean;
};

export function useAppNavigation() {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, options?: NavigateOptions) => {
      startTransition(() => {
        if (options?.replace) {
          router.replace(
            href as never,
            options?.scroll === undefined ? undefined : { scroll: options.scroll },
          );
          return;
        }

        router.push(
          href as never,
          options?.scroll === undefined ? undefined : { scroll: options.scroll },
        );
      });
    },
    [router],
  );

  const prefetch = useCallback(
    (href: string) => {
      router.prefetch(href as never);
    },
    [router],
  );

  return {
    navigate,
    prefetch,
    isNavigating,
  };
}
