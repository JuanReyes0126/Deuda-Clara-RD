import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(value: Date | string, pattern = "d MMM yyyy") {
  return format(new Date(value), pattern, { locale: es });
}

export function formatRelativeDistance(value: Date | string) {
  return formatDistanceToNowStrict(new Date(value), {
    locale: es,
    addSuffix: true,
  });
}
