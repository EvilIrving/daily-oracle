import Foundation
import SwiftData

enum HistorySeedStore {
    private static let dayCount = 300

    static func seedIfNeeded(using modelContext: ModelContext) throws {
        var descriptor = FetchDescriptor<DailyRecord>()
        descriptor.fetchLimit = 1

        guard try modelContext.fetch(descriptor).isEmpty else {
            return
        }

        for record in makeRecords() {
            modelContext.insert(record)
        }

        try modelContext.save()
    }

    static func previewContainer() -> ModelContainer {
        let container = try! OracleModelContainer.makeContainer(inMemory: true)
        try! seedIfNeeded(using: container.mainContext)
        return container
    }

    private static func makeRecords(referenceDate: Date = .now) -> [DailyRecord] {
        let calendar = Calendar.oracle
        let today = calendar.startOfDay(for: referenceDate)

        return (0..<dayCount).map { offset in
            let index = dayCount - offset - 1
            let sample = samples[index % samples.count]
            let mood = index.isMultiple(of: 4) ? nil : QuoteMood.allCases[index % QuoteMood.allCases.count]
            let date = calendar.date(byAdding: .day, value: -offset, to: today) ?? today

            return DailyRecord(
                date: date,
                quoteText: sample.quoteText,
                quoteAuthor: sample.quoteAuthor,
                quoteWork: sample.quoteWork,
                recommended: recommendations[index % recommendations.count],
                avoided: avoidances[index % avoidances.count],
                mood: mood,
                createdAt: date,
                updatedAt: date
            )
        }
    }

    private static let recommendations: [String] = [
        "在自然光下读几页纸质书",
        "出门前慢慢喝完一杯温水",
        "给今天留十分钟不被打断的散步",
        "把最重要的一件事写在纸上",
        "把手机放远一点再开始工作",
        "给老朋友发一句短消息",
        "把窗户打开，让空气换一轮",
        "在晚饭前整理一小块桌面",
        "给自己做一顿像样的早餐",
        "睡前把明天要穿的衣服准备好",
    ]

    private static let avoidances: [String] = [
        "把休息当成需要被证明的东西",
        "同时答应三件明知做不完的事",
        "在情绪最满的时候回复消息",
        "为了显得高效而不停切换任务",
        "把别人的节奏错认成自己的标准",
        "用深夜清醒透支第二天的耐心",
        "把还没发生的事先演成灾难",
        "一边自责一边继续硬撑",
        "把沉默误会成冷淡",
        "在饥饿和疲惫里做重要决定",
    ]

    private static let samples: [QuoteSample] = [
        .init("把日子过得清楚，不等于把每一分钟都排满。", "日课", "晨光集"),
        .init("人真正松弛的时候，手里拿着的东西也会轻一点。", "林岸", "缓慢练习"),
        .init("今天能走多远，不必拿昨天的阴影来量。", "周弥", "向晴处"),
        .init("不是所有停顿都意味着后退，有些只是为了喘匀气息。", "沈迟", "停云"),
        .init("认真生活的人，常常先学会给自己留白。", "许闻", "留白札记"),
        .init("灯亮起来的时候，屋子并没有变大，只是心没那么慌了。", "闻笛", "晚灯"),
        .init("很多答案不是想出来的，是在走路的时候慢慢靠近的。", "姜野", "步行者"),
        .init("把一件小事做好，往往比追问意义更能安顿人。", "何简", "桌边笔记"),
        .init("愿望太大的时候，先照顾好今天这半步。", "陈汀", "半步集"),
        .init("能被说清楚的疲惫，已经比无声的时候轻了一半。", "叶舟", "普通夜晚"),
        .init("别急着证明自己，先把今天过稳。", "赵朴", "地面以上"),
        .init("真正可靠的勇气，看起来往往很安静。", "宋迟", "无声处"),
    ]
}

private struct QuoteSample {
    let quoteText: String
    let quoteAuthor: String
    let quoteWork: String

    init(_ quoteText: String, _ quoteAuthor: String, _ quoteWork: String) {
        self.quoteText = quoteText
        self.quoteAuthor = quoteAuthor
        self.quoteWork = quoteWork
    }
}
