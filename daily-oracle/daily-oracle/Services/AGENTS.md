# Services

- 这里只放外部能力封装，比如 Edge Function、WeatherKit、Location、StoreKit。
- Service 要做成可替换依赖，接口清楚，方便 mock；不要把 SwiftUI 状态或 `@Query` 直接塞进这里。
- 改接口时同步检查调用方、预览假数据和测试替身，避免服务层先跑偏。
