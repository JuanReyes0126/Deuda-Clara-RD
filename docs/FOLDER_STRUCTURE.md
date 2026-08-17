# Estructura de carpetas propuesta

```text
deuda-clara-rd/
├── docs/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   ├── admin/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── charts/
│   │   ├── forms/
│   │   └── layout/
│   ├── features/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── debts/
│   │   ├── notifications/
│   │   ├── payments/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── simulator/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── env/
│   │   ├── security/
│   │   ├── utils/
│   │   └── validations/
│   ├── server/
│   │   ├── auth/
│   │   ├── audit/
│   │   ├── mail/
│   │   ├── notifications/
│   │   ├── planner/
│   │   ├── reports/
│   │   └── services/
│   └── types/
├── tests/
│   ├── integration/
│   ├── unit/
│   └── e2e/
├── .github/
│   └── workflows/
├── docker-compose.yml
├── Dockerfile
├── README.md
└── SECURITY.md
```

## Regla de organización

- `features` agrupa el código por dominio funcional.
- `server` concentra la lógica de negocio y acceso a datos.
- `components` contiene piezas visuales reutilizables.
- `lib` contiene infraestructura y utilidades transversales.
- `tests` separa unit, integration y e2e.
