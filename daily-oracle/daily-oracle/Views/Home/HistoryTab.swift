import SwiftUI
import SwiftData

struct HistoryTab: View {
    @Query(sort: \DailyRecord.date, order: .forward) private var records: [DailyRecord]
    @State private var selectedDate: Date?
    @State private var displayedMonth = CalendarMonthPanelMetrics.monthStart(for: .now)

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: Spacing.md) {
                CalendarMonthPanel(
                    visibleMonth: displayedMonth,
                    selectedDate: selectedDate,
                    canMoveBackward: canMoveBackward,
                    canMoveForward: canMoveForward,
                    onDateSelected: { selectedDate = dayStart(for: $0) },
                    onPreviousMonth: { shiftMonth(by: -1) },
                    onNextMonth: { shiftMonth(by: 1) },
                    isDateSelectable: { !isFutureDay($0) },
                    indicatorColor: { recordsByDay[dayStart(for: $0)]?.mood?.color }
                )
                detailCard
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.lg)
            .padding(.bottom, 120)
        }
        .background(AppColors.backgroundPrimary)
        .onAppear {
            syncSelection()
        }
        .onChange(of: records.count, initial: true) {
            syncSelection()
        }
    }

    private var detailCard: some View {
        Group {
            if let record = selectedRecord {
                HistoryDetailCard(record: record)
            } else {
                ContentUnavailableView(
                    "这天还没有内容",
                    systemImage: "calendar.badge.exclamationmark",
                    description: Text("先在本地补数据，后面再接真实历史。")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.xl)
                .background(
                    RoundedRectangle(cornerRadius: Radius.lg)
                        .fill(AppColors.backgroundSecondary)
                )
            }
        }
    }

    private var canMoveForward: Bool {
        guard let latestMonth else { return false }
        return displayedMonth < latestMonth
    }

    private var canMoveBackward: Bool {
        guard let earliestMonth else { return false }
        return displayedMonth > earliestMonth
    }

    private var recordsByDay: [Date: DailyRecord] {
        Dictionary(uniqueKeysWithValues: records.map { (dayStart(for: $0.date), $0) })
    }

    private var earliestMonth: Date? {
        records.first.map { CalendarMonthPanelMetrics.monthStart(for: $0.date) }
    }

    private var latestMonth: Date? {
        records.last.map { CalendarMonthPanelMetrics.monthStart(for: $0.date) }
    }

    private var selectedRecord: DailyRecord? {
        guard let selectedDate else { return records.last }
        return recordsByDay[dayStart(for: selectedDate)]
    }

    private func syncSelection() {
        guard !records.isEmpty else { return }

        let preferredDate = selectedDate ?? records.last?.date ?? .now
        let normalized = dayStart(for: preferredDate)
        selectedDate = recordsByDay[normalized]?.date ?? records.last?.date
        let month = CalendarMonthPanelMetrics.monthStart(for: selectedDate ?? preferredDate)
        displayedMonth = clampedMonth(month)
    }

    private func shiftMonth(by value: Int) {
        guard let month = Calendar.oracle.date(byAdding: .month, value: value, to: displayedMonth) else { return }
        displayedMonth = clampedMonth(CalendarMonthPanelMetrics.monthStart(for: month))

        if let firstRecord = records.first(where: { isSameMonth($0.date, displayedMonth) }) {
            selectedDate = firstRecord.date
        } else {
            selectedDate = displayedMonth
        }
    }

    private func clampedMonth(_ month: Date) -> Date {
        guard let earliestMonth, let latestMonth else { return month }
        if month < earliestMonth { return earliestMonth }
        if month > latestMonth { return latestMonth }
        return month
    }

    private func dayStart(for date: Date) -> Date {
        Calendar.oracle.startOfDay(for: date)
    }

    private func isFutureDay(_ date: Date) -> Bool {
        dayStart(for: date) > dayStart(for: .now)
    }

    private func isSameMonth(_ lhs: Date, _ rhs: Date) -> Bool {
        let left = Calendar.oracle.dateComponents([.year, .month], from: lhs)
        let right = Calendar.oracle.dateComponents([.year, .month], from: rhs)
        return left.year == right.year && left.month == right.month
    }
}

private struct HistoryDetailCard: View {
    let record: DailyRecord

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(detailDate)
                .font(.detailDate)
                .foregroundStyle(AppColors.textTertiary)

            WidgetPreviewLarge(record: WidgetPreviewLargeRecord(record: record))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var detailDate: String {
        HistoryTabFormatters.detailFormatter.string(from: record.date)
    }
}

private enum HistoryTabFormatters {
    static let detailFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.oracle
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月 d日 · EEEE"
        return formatter
    }()
}

#Preview {
    HistoryTab()
        .modelContainer(HistorySeedStore.previewContainer())
}
