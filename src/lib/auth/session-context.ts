import type {
  MembershipSettingsPublicDto,
  UserPublicDto,
  UserSettingsPublicDto,
} from "@/lib/types/app";

export type SessionUserContextDto = UserPublicDto & {
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  timezone: string;
  onboardingCompleted: boolean;
};

export type CurrentSessionDto = {
  id: string;
  userId: string;
  expires: Date;
  user: SessionUserContextDto;
};

export type ServerUserSettingsContextDto =
  UserSettingsPublicDto &
  MembershipSettingsPublicDto;

export type ServerUserContextDto = SessionUserContextDto & {
  settings: ServerUserSettingsContextDto | null;
};
