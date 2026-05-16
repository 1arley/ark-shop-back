## [1.19.2](https://github.com/1arley/ark-shop-back/compare/v1.19.1...v1.19.2) (2026-05-16)

### Bug Fixes

- add missing emailVerified migration and prevent unhandled rejection crash ([9f70286](https://github.com/1arley/ark-shop-back/commit/9f70286b4c00db17553233bd85b5e09e071395e8))

## [1.19.1](https://github.com/1arley/ark-shop-back/compare/v1.19.0...v1.19.1) (2026-05-16)

### Bug Fixes

- replace Bull queue with direct email service calls to fix 500 on register ([6e12621](https://github.com/1arley/ark-shop-back/commit/6e12621b760cf12803cdf5fdca3005c6a350aaf7))

# [1.19.0](https://github.com/1arley/ark-shop-back/compare/v1.18.0...v1.19.0) (2026-05-16)

### Features

- integrate Resend for email delivery, add email verification and OTP password reset ([c9c4c60](https://github.com/1arley/ark-shop-back/commit/c9c4c608ce212cf19e3a60218d897c09a82f4891))

# [1.18.0](https://github.com/1arley/ark-shop-back/compare/v1.17.0...v1.18.0) (2026-05-16)

### Features

- adicionar 'Lembrar de mim' com auto-refresh de token e logout por inatividade ([00e81ab](https://github.com/1arley/ark-shop-back/commit/00e81ab68457bd92c999e7b7179f1fab3fcacd63))

# [1.17.0](https://github.com/1arley/ark-shop-back/compare/v1.16.2...v1.17.0) (2026-05-15)

### Features

- adicionar proteção contra produtos duplicados na importação CSV ([7844616](https://github.com/1arley/ark-shop-back/commit/78446160e792d9969b42698c5e20a7f15e4e1a8f))

## [1.16.2](https://github.com/1arley/ark-shop-back/compare/v1.16.1...v1.16.2) (2026-05-15)

### Bug Fixes

- corrigir parser CSV para lidar com formato Google Sheets com colunas extras ([aadf75f](https://github.com/1arley/ark-shop-back/commit/aadf75fa0db292808af70fa81649d07636e7c4af))

## [1.16.1](https://github.com/1arley/ark-shop-back/compare/v1.16.0...v1.16.1) (2026-05-15)

### Bug Fixes

- corrigir importação CSV - adicionar endpoint file upload e validar erros ([9eecc62](https://github.com/1arley/ark-shop-back/commit/9eecc62f34dee975173abc5b94b770bb06e4cc3e))

# [1.16.0](https://github.com/1arley/ark-shop-back/compare/v1.15.1...v1.16.0) (2026-05-15)

### Features

- implementar importação de produtos via CSV ([0bd5fa5](https://github.com/1arley/ark-shop-back/commit/0bd5fa5970071a285e443bb5684fd3ce930d0775))

## [1.15.1](https://github.com/1arley/ark-shop-back/compare/v1.15.0...v1.15.1) (2026-05-15)

### Bug Fixes

- atualiza seed para limpar banco e criar apenas 3 categorias e 3 contas principais ([ac97ff1](https://github.com/1arley/ark-shop-back/commit/ac97ff1254b49091f03e2ed7f7c378a0c86e2984))

# [1.15.0](https://github.com/1arley/ark-shop-back/compare/v1.14.0...v1.15.0) (2026-05-15)

### Features

- adiciona importação de produtos via CSV com segurança e performance ([c4f702c](https://github.com/1arley/ark-shop-back/commit/c4f702ca75e4119a6dd9e0c8d57280098709814b))

# [1.14.0](https://github.com/1arley/ark-shop-back/compare/v1.13.10...v1.14.0) (2026-05-15)

### Features

- add 15-minute expiration to PIX payments ([76a87a1](https://github.com/1arley/ark-shop-back/commit/76a87a1c42554ef89510d0aba2454e0e84a50708))

## [1.13.10](https://github.com/1arley/ark-shop-back/compare/v1.13.9...v1.13.10) (2026-05-15)

### Bug Fixes

- swap pixQrCode and pixCode fields in payment creation ([de03312](https://github.com/1arley/ark-shop-back/commit/de033124db5f8437b880ad82713d44ca889d9cee))

## [1.13.9](https://github.com/1arley/ark-shop-back/compare/v1.13.8...v1.13.9) (2026-05-15)

### Bug Fixes

- fall back to ASAAS when unregistered payment provider (MERCADO_PAGO) is requested ([dc756e6](https://github.com/1arley/ark-shop-back/commit/dc756e6833e03e8dfef8dc6d031ca97b17bc4a44))

## [1.13.8](https://github.com/1arley/ark-shop-back/compare/v1.13.7...v1.13.8) (2026-05-15)

### Bug Fixes

- resolve critical security, quality, and stability issues across the codebase ([65799cd](https://github.com/1arley/ark-shop-back/commit/65799cde426b56e221206076a39395a023659154))

## [1.13.7](https://github.com/1arley/ark-shop-back/compare/v1.13.6...v1.13.7) (2026-05-15)

### Bug Fixes

- only load .env.local in non-production to prevent dev config from overriding production ([21cd126](https://github.com/1arley/ark-shop-back/commit/21cd126b57a55bf441fc947684a05399581832bd))

## [1.13.6](https://github.com/1arley/ark-shop-back/compare/v1.13.5...v1.13.6) (2026-05-15)

### Bug Fixes

- resolve critical security and code quality issues across the codebase ([668c79c](https://github.com/1arley/ark-shop-back/commit/668c79c1f0fb1dfe805aca8d11439e06c8d4bfbc))

## [1.13.5](https://github.com/1arley/ark-shop-back/compare/v1.13.4...v1.13.5) (2026-05-15)

### Bug Fixes

- resolve security vulnerabilities, bugs, and code quality issues across the codebase ([84e742d](https://github.com/1arley/ark-shop-back/commit/84e742ddefa9f926aff8ef017b9dee1492aef807))

## [1.13.4](https://github.com/1arley/ark-shop-back/compare/v1.13.3...v1.13.4) (2026-05-15)

### Bug Fixes

- resolve security vulnerabilities, bugs, and code quality issues ([b774e21](https://github.com/1arley/ark-shop-back/commit/b774e2103862c6f81bb4ccf0b817db61bea52f04))

## [1.13.3](https://github.com/1arley/ark-shop-back/compare/v1.13.2...v1.13.3) (2026-05-14)

### Bug Fixes

- add force delete option for categories and improve error messages ([b9e4e2e](https://github.com/1arley/ark-shop-back/commit/b9e4e2e85c546dd6e95f10da6a333fb5b326de35))

## [1.13.2](https://github.com/1arley/ark-shop-back/compare/v1.13.1...v1.13.2) (2026-05-14)

### Bug Fixes

- add prisma:migrate:deploy script for production deployments ([7035865](https://github.com/1arley/ark-shop-back/commit/7035865424634e35ab7d0408d887269075cd7f08))

## [1.13.1](https://github.com/1arley/ark-shop-back/compare/v1.13.0...v1.13.1) (2026-05-14)

### Bug Fixes

- remove duplicate commands from product imageUrl migration ([bac33b0](https://github.com/1arley/ark-shop-back/commit/bac33b0beacda95627a77af9c8780db249bb21a6))

# [1.13.0](https://github.com/1arley/ark-shop-back/compare/v1.12.1...v1.13.0) (2026-05-14)

### Features

- new dependencies in package.json ([e183803](https://github.com/1arley/ark-shop-back/commit/e183803a1db21818a0f6e64184acd18fbff54d44))

## [1.12.1](https://github.com/1arley/ark-shop-back/compare/v1.12.0...v1.12.1) (2026-05-13)

### Bug Fixes

- log split details in Asaas payment creation ([6225fb0](https://github.com/1arley/ark-shop-back/commit/6225fb07d71e415bf85c682bc2737d2d30078cd4))

# [1.12.0](https://github.com/1arley/ark-shop-back/compare/v1.11.0...v1.12.0) (2026-05-13)

### Features

- role permissions - ADMIN cannot change roles, modify or delete SUPERADMIN ([42c6bda](https://github.com/1arley/ark-shop-back/commit/42c6bda81c57137014b7d197a81fe8f407c29f7e))

# [1.11.0](https://github.com/1arley/ark-shop-back/compare/v1.10.0...v1.11.0) (2026-05-13)

### Features

- role hierarchy and permission guards ([c6f9ff2](https://github.com/1arley/ark-shop-back/commit/c6f9ff2a8e0fc95161000cbd1502aed064834942))

### Reverts

- role hierarchy and permission guards ([8dd50d5](https://github.com/1arley/ark-shop-back/commit/8dd50d59678bb7730e985f93048c3852fbf9932e))

# [1.10.0](https://github.com/1arley/ark-shop-back/compare/v1.9.1...v1.10.0) (2026-05-13)

### Bug Fixes

- controller tests - register mock and 2nd arg (Response) ([089c1ed](https://github.com/1arley/ark-shop-back/commit/089c1ed508a8a3905ecfa3d87d3be85837975a19))
- sameSite=None for cross-origin cookies between Vercel and Railway ([9794143](https://github.com/1arley/ark-shop-back/commit/979414378c919d9023e42f68070ea9ae0618f40b))

### Features

- auth cookies httpOnly on register + GET /auth/me endpoint ([f0d920c](https://github.com/1arley/ark-shop-back/commit/f0d920cdbc6ed88cab35c48baa4e1df365adcc1e))

## [1.9.1](https://github.com/1arley/ark-shop-back/compare/v1.9.0...v1.9.1) (2026-05-13)

### Bug Fixes

- add imageUrl to Product schema, fix cart response shape, fix download keys ([62d6773](https://github.com/1arley/ark-shop-back/commit/62d6773fcaebe0d712f96f94d12cf298a2247e67))

# [1.9.0](https://github.com/1arley/ark-shop-back/compare/v1.8.4...v1.9.0) (2026-05-13)

### Features

- add /admin/sellers CRUD endpoints matching admin panel pattern ([75f155f](https://github.com/1arley/ark-shop-back/commit/75f155fddfa46e767be5b56bddfe4b32d33c04af))

## [1.8.4](https://github.com/1arley/ark-shop-back/compare/v1.8.3...v1.8.4) (2026-05-13)

### Bug Fixes

- use rawBody:true without bodyParser:false to avoid breaking JSON parsing ([0ed5631](https://github.com/1arley/ark-shop-back/commit/0ed5631fbc53af950dc9bf753271f35edf6d7ac8))

## [1.8.3](https://github.com/1arley/ark-shop-back/compare/v1.8.2...v1.8.3) (2026-05-13)

### Bug Fixes

- use express.json verify callback instead of rawBody:true to avoid breaking global JSON parser ([ad09505](https://github.com/1arley/ark-shop-back/commit/ad0950577ddd9c27de1315b8a47b412527c47162))

## [1.8.2](https://github.com/1arley/ark-shop-back/compare/v1.8.1...v1.8.2) (2026-05-13)

### Bug Fixes

- restore rawBody:true and remove conflicting RawBodyMiddleware ([3a9d16c](https://github.com/1arley/ark-shop-back/commit/3a9d16c31e986cfa0cf473d6e47ade544568a8fa))

## [1.8.1](https://github.com/1arley/ark-shop-back/compare/v1.8.0...v1.8.1) (2026-05-13)

### Bug Fixes

- remove RawBodyMiddleware that hangs requests - NestJS rawBody:true already handles it ([f5aafb7](https://github.com/1arley/ark-shop-back/commit/f5aafb7c5789824bd5c7beb739633d5147e284c3))

# [1.8.0](https://github.com/1arley/ark-shop-back/compare/v1.7.1...v1.8.0) (2026-05-13)

### Bug Fixes

- add wget and dynamic port to healthcheck ([14d7b32](https://github.com/1arley/ark-shop-back/commit/14d7b32140ed378094e29972f148842d6ad92f4a))
- auth service test - register test missing JWT mock and outdated assertion ([b486355](https://github.com/1arley/ark-shop-back/commit/b486355bc4ec7a5a7804f698e1573173d100bfc4))
- code review issues - Asaas provider timeout, PIX QR field mapping, providerTxId persistence, rawBody, seller lookup, error propagation ([680bc41](https://github.com/1arley/ark-shop-back/commit/680bc4111cb1a81773b75cc0f7b124ee05817163))
- prisma connection timeout and add @nestjs/axios ([f9028c1](https://github.com/1arley/ark-shop-back/commit/f9028c1eef34a96e28386663926c0a2b5f0d722c))
- return tokens on register and refresh_token on login ([4b68fd8](https://github.com/1arley/ark-shop-back/commit/4b68fd8c3a296aa050b9367d3b33bb6416109f33))
- s3 url using UPLOAD_BASE_URL instead of hardcoded ([2b7b188](https://github.com/1arley/ark-shop-back/commit/2b7b188aec330c6949af34ad894bb7318eee70ec))

### Features

- add admin user management endpoints ([3b2f047](https://github.com/1arley/ark-shop-back/commit/3b2f047aaf04c1a51f989e2ef1c1279d13b126bd))
- add notifications, sellers, upload, keys modules ([3e7244d](https://github.com/1arley/ark-shop-back/commit/3e7244de0c9ed77f1a24319e2e6299fcf29b4930))
- **admin:** add CRUD endpoints for products, orders, and key inventory management ([f6bb763](https://github.com/1arley/ark-shop-back/commit/f6bb763b88740027b8a0ec66f0f69ec6a378a927))
- **contact:** add contact module for handling user inquiries ([7e0d380](https://github.com/1arley/ark-shop-back/commit/7e0d380a8544920f4c54d106c1132c726d7d220a))
- implement cookie-based authentication with access and refresh tokens ([a4874d4](https://github.com/1arley/ark-shop-back/commit/a4874d4080658f30a8494c87dcf8a0b146989a24))
- migrate payment provider to Asaas with marketplace split ([cb0e218](https://github.com/1arley/ark-shop-back/commit/cb0e2186f1a6ae35d949510401acbd15368badec))
- migrate to Mercado Pago Orders API and add payer fields ([4cbd382](https://github.com/1arley/ark-shop-back/commit/4cbd382370d463d8f3608b83e0bfa41806093d0b))
- production readiness - Helmet, Sentry, graceful shutdown, real health checks, Asaas-ready provider architecture ([7519901](https://github.com/1arley/ark-shop-back/commit/7519901a9c42846c6e50e6db4bdab8ac756ed376))

## [1.7.1](https://github.com/1arley/ark-shop-back/compare/v1.7.0...v1.7.1) (2026-05-12)

### Bug Fixes

- resolve Prisma 7 compatibility and database connection issues ([ad0e048](https://github.com/1arley/ark-shop-back/commit/ad0e04805198620c9cefdc8f392e71bfc5c3fdd6))

# [1.7.0](https://github.com/1arley/ark-shop-back/compare/v1.6.1...v1.7.0) (2026-05-12)

### Features

- add comprehensive documentation for quick start, email setup, architecture, and API ([4da2947](https://github.com/1arley/ark-shop-back/commit/4da29471fe848d4375811b4c7ad612ed2562b98a))
- create entry script and update build process for Vercel compatibility ([5a76da4](https://github.com/1arley/ark-shop-back/commit/5a76da4e6252a4958f86fea4f3a7e6207b7fff1e))
- enhance build script for Vercel compatibility by adding src removal ([d574a16](https://github.com/1arley/ark-shop-back/commit/d574a16472a8d103a0f5511ed225aaa98e333fb7))
- refactor build process for Vercel compatibility and add runner script ([7090fda](https://github.com/1arley/ark-shop-back/commit/7090fda864032db0c77f266cadbf3895d7018f8a))
- update TypeScript module settings to use node16 ([e87ac54](https://github.com/1arley/ark-shop-back/commit/e87ac54094a695220d9d0cee6c8ec3303da6fc56))

## [1.6.1](https://github.com/1arley/ark-shop-back/compare/v1.6.0...v1.6.1) (2026-05-12)

### Bug Fixes

- improve error handling during app initialization and enforce DATABASE_URL requirement ([92064ca](https://github.com/1arley/ark-shop-back/commit/92064ca31c0b97a3d2de6a26f024f92ea313eaf4))

# [1.6.0](https://github.com/1arley/ark-shop-back/compare/v1.5.0...v1.6.0) (2026-05-12)

### Bug Fixes

- update import statement for supertest to use default import ([acefb5f](https://github.com/1arley/ark-shop-back/commit/acefb5f0ac6cfcf17c826c9719a69a1aa327f93f))

### Features

- add module-alias dependency and configure path aliases in index.js ([f0fbf2d](https://github.com/1arley/ark-shop-back/commit/f0fbf2d922be61b9663e156ad5c35311f1311965))

# [1.5.0](https://github.com/1arley/ark-shop-back/compare/v1.4.2...v1.5.0) (2026-05-12)

### Features

- add @nestjs/axios and tsc-alias dependencies; update build script ([3fcfebc](https://github.com/1arley/ark-shop-back/commit/3fcfebc63419da0c2a7535e1aa4fa0238ad0ee9d))

## [1.4.2](https://github.com/1arley/ark-shop-back/compare/v1.4.1...v1.4.2) (2026-05-12)

### Bug Fixes

- resolve path alias issue in app.module.ts for Vercel deployment ([e186535](https://github.com/1arley/ark-shop-back/commit/e186535c75e79a53e51cff7532c2b3b4d5a0990f))

## [1.4.1](https://github.com/1arley/ark-shop-back/compare/v1.4.0...v1.4.1) (2026-05-11)

### Bug Fixes

- @/app.module to ../app.module ([14e2df1](https://github.com/1arley/ark-shop-back/commit/14e2df1dcea851c089bb510a676327c82dbfb53f))

# [1.4.0](https://github.com/1arley/ark-shop-back/compare/v1.3.1...v1.4.0) (2026-05-11)

### Bug Fixes

- include prisma.config.ts in production build ([3427e48](https://github.com/1arley/ark-shop-back/commit/3427e48dc61623f6a8760ad249dcd1e80eccf885))

### Features

- configure Vercel deployment support with serverless handler and request rewrites ([abb1897](https://github.com/1arley/ark-shop-back/commit/abb189726c31a8b87f8768bc30f37b7ecad9a72f))

## [1.3.1](https://github.com/1arley/ark-shop-back/compare/v1.3.0...v1.3.1) (2026-05-11)

### Bug Fixes

- enhance security and performance across the backend ([39295ed](https://github.com/1arley/ark-shop-back/commit/39295ed250cd9704f4c426f361f724b0739a8804))
- minor lint errors ([4e0389e](https://github.com/1arley/ark-shop-back/commit/4e0389ef86d9342a88f5b174f6030104ffcde249))

# [1.3.0](https://github.com/1arley/ark-shop-back/compare/v1.2.0...v1.3.0) (2026-05-11)

### Bug Fixes

- add authentication to user list and improve pagination security ([208fc75](https://github.com/1arley/ark-shop-back/commit/208fc75d94c51006533a628216a4c1e4084edf40))
- add confirmation token requirement for clear demo data ([6a57486](https://github.com/1arley/ark-shop-back/commit/6a57486549175a63932cd20f750626edc0a2ae7e))
- add CORS origin validation for production environments ([d5583d5](https://github.com/1arley/ark-shop-back/commit/d5583d5f34b288292bc615e560a2dfd069570018))
- enforce encryption key requirement and improve email service health checks ([6a782f7](https://github.com/1arley/ark-shop-back/commit/6a782f7e269a3bf5de22142924e86166973a3965))
- enforce webhook signature verification and fail-closed security ([2fcd7ae](https://github.com/1arley/ark-shop-back/commit/2fcd7ae1cc6d94a330744a9c04a1fd76e64b7c60))
- return only necessary fields from JWT validate method ([8694c4a](https://github.com/1arley/ark-shop-back/commit/8694c4a1b2874eb66f6b9696e45250a6eb18fb68))

### Features

- add supabase-setup.ps1 script ([c3355f2](https://github.com/1arley/ark-shop-back/commit/c3355f201bf18924a2273d19e6bed6ecdc0d74af))

### Performance Improvements

- fix N+1 queries in cart and orders + prevent TOCTOU race condition ([43fb827](https://github.com/1arley/ark-shop-back/commit/43fb8278ef49d308436bbfd8d21ec7924083da74))

# [1.2.0](https://github.com/1arley/ark-shop-back/compare/v1.1.1...v1.2.0) (2026-05-09)

### Bug Fixes

- **cors:** remove dead code ([370e0a9](https://github.com/1arley/ark-shop-back/commit/370e0a9beb809ebc8bde02ae6bb2c3237842a5dc))
- **main:** remove unused isProduction variable ([145fd58](https://github.com/1arley/ark-shop-back/commit/145fd5840f1f319d85430a49903e04ddbccaae8c))
- update order creation and retrieval to use userId directly ([367f34e](https://github.com/1arley/ark-shop-back/commit/367f34e76acf476543a8e6f0567d0802fc58b81f))

### Features

- **payments:** automate order delivery upon payment approval ([f9d1194](https://github.com/1arley/ark-shop-back/commit/f9d1194ec24582a4f94be71106b9cebbb5a6bfbe))
- **throttling:** add ThrottlerModule for rate limiting and configure APP_GUARD ([a2230d0](https://github.com/1arley/ark-shop-back/commit/a2230d0aa73b99dd9e17031e3030e560dadefeeb))

## [1.1.1](https://github.com/1arley/ark-shop-back/compare/v1.1.0...v1.1.1) (2026-05-09)

### Bug Fixes

- **security:** fail-fast on missing encryption key in production ([097e246](https://github.com/1arley/ark-shop-back/commit/097e246559edfb8296ef38d38a5b91a13cdaa397)), closes [#1](https://github.com/1arley/ark-shop-back/issues/1)
- **security:** implement fail-fast behavior for missing encryption key in production ([bad5498](https://github.com/1arley/ark-shop-back/commit/bad54983c4ccb5f9960dd66dc7f471767cf2e111))

# [1.1.0](https://github.com/1arley/ark-shop-back/compare/v1.0.0...v1.1.0) (2026-05-08)

### Bug Fixes

- apply prettier formatting to health controller and app module ([64c2831](https://github.com/1arley/ark-shop-back/commit/64c2831a76020dd876d451e9e04e21ae37b3efbe))

### Features

- add health check, logger, and metrics modules ([2af5377](https://github.com/1arley/ark-shop-back/commit/2af53774afd2eb731cb5865ce9bd1e81f2ca1dba))

# 1.0.0 (2026-05-08)

### Bug Fixes

- add BullModule configuration for email queue ([86c76a6](https://github.com/1arley/ark-shop-back/commit/86c76a623e141f712f43f5c7673f81b08de538c8))
- change job runners to use ubuntu-latest instead of self-hosted ([7671a9e](https://github.com/1arley/ark-shop-back/commit/7671a9e94882da7a4ff61927bfdeb9e87849b8c8))
- corrigir imports e métodos faltando para build ([d245b55](https://github.com/1arley/ark-shop-back/commit/d245b556c74781240825ea851c50b1002b8ae6cf))
- error lint changes needed ([5210150](https://github.com/1arley/ark-shop-back/commit/521015004f7b835b2eb773842131f5287cf8ad89))
- implement critical delivery flow and fix authorization gaps ([586273a](https://github.com/1arley/ark-shop-back/commit/586273acff275de3305d74faaddf9ce4b792978a))
- import BullModule in OrdersModule for email queue ([e3c8559](https://github.com/1arley/ark-shop-back/commit/e3c8559f067e48063bf10ffc1fb67c3e922d33ed))
- prevent duplicate payment record creation for PIX method ([61e9cd9](https://github.com/1arley/ark-shop-back/commit/61e9cd9db4d183fe0b28d8b1f08ce4a5c18cb681))
- remove decryptedKey references, keys delivered by admin ([f1bc0d1](https://github.com/1arley/ark-shop-back/commit/f1bc0d126f36255543047b885c1ba68a0d0d09b8))
- resolve all TypeScript compilation errors ([8ddd444](https://github.com/1arley/ark-shop-back/commit/8ddd444109171d57a094c4707b500d3832126b8b))
- resolve remaining lint errors in payments module ([d2106ab](https://github.com/1arley/ark-shop-back/commit/d2106ab5d8330ad48d420141956f506049f84d2c))
- resolve TypeScript errors in admin and payments modules ([56da87f](https://github.com/1arley/ark-shop-back/commit/56da87f10c1cb33a6a850649a3b6a75e9867736b))
- resolve TypeScript errors in email processor ([b994a9f](https://github.com/1arley/ark-shop-back/commit/b994a9f8e3ad0406d9d661ce6e84a53e60378341))
- rewrite orders.service.ts to fix corruption ([10b55c4](https://github.com/1arley/ark-shop-back/commit/10b55c44643862d963c6f9c4e7e6587e22f954a2))
- update repository URLs in package.json to reflect the correct project ([2fe5525](https://github.com/1arley/ark-shop-back/commit/2fe55256359905f188d51401da9f794d124242f9))

### Features

- add categories, admin dashboard, and antifraud modules ([a59b015](https://github.com/1arley/ark-shop-back/commit/a59b0156db0eaaaee03d76c947054c37664d4de3))
- add DTO validation for create payment endpoint ([ce25164](https://github.com/1arley/ark-shop-back/commit/ce25164b9e0b9b284cc79143b4fb1febd9f61817))
- add raw body middleware for webhook signature verification ([c3b2197](https://github.com/1arley/ark-shop-back/commit/c3b2197894d84aff2a05d277f0e17689114d39d6))
- add rejection reason field to Payment model ([9e5d38b](https://github.com/1arley/ark-shop-back/commit/9e5d38b082d71897422a7a6b46270f89ca34af13))
- add safe type checking in webhook handlers ([a20ed36](https://github.com/1arley/ark-shop-back/commit/a20ed366fa8bea36e91a2a37a9b7d942f9c7d9f1))
- add shopping cart and Mercado Pago integration ([7da802e](https://github.com/1arley/ark-shop-back/commit/7da802e30def454df41c5a1e9a561389d86ed8ea))
- implement email notification system ([72ed86f](https://github.com/1arley/ark-shop-back/commit/72ed86fbd626f2f9fd3d5d39f538e51e8e606979))
- implement Mercado Pago webhooks with signature verification ([14b2981](https://github.com/1arley/ark-shop-back/commit/14b29818493908273f638818dd332c4dbba9f6ec))
- implement real Mercado Pago payment integration ([ab0c0ff](https://github.com/1arley/ark-shop-back/commit/ab0c0ffa1f382b586af65ccfacbbf7a514da076f))
- initialize database schema with wallet, order, product, and payment management tables ([3053dae](https://github.com/1arley/ark-shop-back/commit/3053dae4f52820838ede6322ae0d1571074a3a08))
- update app module with cart support and add production docs ([3e37e0e](https://github.com/1arley/ark-shop-back/commit/3e37e0e63f5fa9cb185e338026636fae7ac2ef8b))
