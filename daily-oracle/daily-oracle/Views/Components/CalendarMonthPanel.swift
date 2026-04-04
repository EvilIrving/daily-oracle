import SwiftUI

struct CalendarMonthPanel: View {
    let visibleMonth: Date
    let selectedDate: Date?
    let canMoveBackward: Bool
    let canMoveForward: Bool
    let onDateSelected: (Date) -> Void
    let onPreviousMonth: () -> Void
    let onNextMonth: () -> Void
    let isDateSelectable: (Date) -> Bool
    let indicatorColor: (Date) -> Color?

    var body: some View {
        VStack(spacing: Spacing.md) {
            monthHeader
            weekdayHeader
            monthGrid
        }
    }

    private var monthHeader: some View {
        HStack {
            Button(action: onPreviousMonth) {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(AppColors.textTertiary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canMoveBackward)
            .opacity(canMoveBackward ? 1 : 0.35)

            Spacer()

            Text(CalendarMonthPanelMetrics.monthFormatter.string(from: visibleMonth))
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(AppColors.textPrimary)

            Spacer()

            Button(action: onNextMonth) {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(AppColors.textTertiary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!canMoveForward)
            .opacity(canMoveForward ? 1 : 0.35)
        }
        .padding(.horizontal, Spacing.sm)
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(CalendarMonthPanelMetrics.weekdayLabels, id: \.self) { weekday in
                Text(weekday)
                    .font(.calMonth)
                    .foregroundStyle(AppColors.textTertiary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, Spacing.xs)
    }

    private var monthGrid: some View {
        let cells = CalendarMonthPanelMetrics.cells(for: visibleMonth)
        let rowCount = max(cells.count / 7, 1)

        return GeometryReader { geometry in
            let cellHeight = (geometry.size.height - CGFloat(rowCount - 1) * CalendarMonthPanelMetrics.gridSpacing) / CGFloat(rowCount)

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: CalendarMonthPanelMetrics.gridSpacing), count: 7),
                spacing: CalendarMonthPanelMetrics.gridSpacing
            ) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, cellDate in
                    if let date = cellDate {
                        CalendarMonthDayCell(
                            date: date,
                            isSelected: isSameDay(date, selectedDate),
                            isToday: isSameDay(date, .now),
                            isSelectable: isDateSelectable(date),
                            indicatorColor: indicatorColor(date),
                            cellHeight: cellHeight
                        ) {
                            onDateSelected(date)
                        }
                    } else {
                        Color.clear
                            .frame(maxWidth: .infinity)
                            .frame(height: cellHeight)
                    }
                }
            }
        }
        .frame(height: CalendarMonthPanelMetrics.gridHeight)
    }

    private func isSameDay(_ lhs: Date, _ rhs: Date?) -> Bool {
        guard let rhs else { return false }
        return Calendar.oracle.isDate(lhs, inSameDayAs: rhs)
    }
}

private struct CalendarMonthDayCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let isSelectable: Bool
    let indicatorColor: Color?
    let cellHeight: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: cellSpacing) {
                Text("\(Calendar.oracle.component(.day, from: date))")
                    .font(.system(size: 14, weight: isToday ? .semibold : .regular))
                    .foregroundStyle(isToday ? AppColors.textPrimary : AppColors.textSecondary)

                Circle()
                    .fill(indicatorColor ?? .clear)
                    .frame(width: indicatorSize, height: indicatorSize)
                    .opacity(indicatorColor == nil ? 0 : 1)
            }
            .frame(maxWidth: .infinity)
            .frame(height: cellHeight)
            .background(backgroundShape)
        }
        .buttonStyle(.plain)
        .disabled(!isSelectable)
        .opacity(isSelectable ? 1 : 0.4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(CalendarMonthPanelMetrics.accessibilityFormatter.string(from: date))
    }

    @ViewBuilder
    private var backgroundShape: some View {
        if isSelected {
            RoundedRectangle(cornerRadius: min(cellHeight / 2, Radius.lg))
                .fill(AppColors.borderTertiary)
        } else if isToday {
            RoundedRectangle(cornerRadius: min(cellHeight / 2, Radius.lg))
                .fill(AppColors.backgroundSecondary)
        } else {
            Color.clear
        }
    }

    private var indicatorSize: CGFloat {
        min(max(cellHeight * 0.22, 8), 12)
    }

    private var cellSpacing: CGFloat {
        min(max(cellHeight * 0.12, 4), 6)
    }
}

enum CalendarMonthPanelMetrics {
    static let gridHeight: CGFloat = 320
    static let gridSpacing: CGFloat = 8
    static let weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"]

    static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.oracle
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "yyyy年 M月"
        return formatter
    }()

    static let accessibilityFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.oracle
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateStyle = .full
        return formatter
    }()

    static func monthStart(for date: Date) -> Date {
        let components = Calendar.oracle.dateComponents([.year, .month], from: date)
        return Calendar.oracle.date(from: components) ?? Calendar.oracle.startOfDay(for: date)
    }

    static func cells(for month: Date) -> [Date?] {
        let calendar = Calendar.oracle
        let monthStart = monthStart(for: month)
        let dayRange = calendar.range(of: .day, in: .month, for: monthStart) ?? 1..<2
        let leadingOffset = calendar.component(.weekday, from: monthStart) - 1
        let dayCount = dayRange.count
        let totalCells = ((leadingOffset + dayCount + 6) / 7) * 7

        return (0..<totalCells).map { index in
            let day = index - leadingOffset + 1
            guard day >= 1, day <= dayCount else { return nil }
            return calendar.date(byAdding: .day, value: day - 1, to: monthStart)
        }
    }
}
