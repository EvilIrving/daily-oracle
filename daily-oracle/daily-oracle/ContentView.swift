import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.colorScheme) private var colorScheme

    @AppStorage("oracle.theme") private var themeRawValue = OracleAccentTheme.ink.rawValue
    @AppStorage("oracle.fontStyle") private var fontRawValue = OracleFontStyle.serif.rawValue
    @AppStorage("oracle.widgetSize") private var widgetSizeRawValue = OracleWidgetSize.large.rawValue

    @StateObject private var model = OracleAppModel()

    private var accentTheme: OracleAccentTheme {
        OracleAccentTheme(rawValue: themeRawValue) ?? .ink
    }

    private var fontStyle: OracleFontStyle {
        OracleFontStyle(rawValue: fontRawValue) ?? .serif
    }

    private var widgetSize: OracleWidgetSize {
        get { OracleWidgetSize(rawValue: widgetSizeRawValue) ?? .large }
        set { widgetSizeRawValue = newValue.rawValue }
    }

    var body: some View {
        let palette = OraclePalette.current(for: colorScheme, accent: accentTheme)

        ZStack(alignment: .bottom) {
            palette.backgroundTertiary.ignoresSafeArea()

            VStack(spacing: 0) {
                switch model.selectedTab {
                case .history:
                    HistoryTabView(
                        model: model,
                        palette: palette,
                        fontStyle: fontStyle
                    )
                case .settings:
                    SettingsTabView(
                        model: model,
                        palette: palette,
                        fontStyle: fontStyle,
                        theme: accentTheme,
                        widgetSize: Binding(
                            get: { OracleWidgetSize(rawValue: widgetSizeRawValue) ?? .large },
                            set: { widgetSizeRawValue = $0.rawValue }
                        ),
                        onThemeChange: { themeRawValue = $0.rawValue },
                        onFontChange: { fontRawValue = $0.rawValue }
                    )
                }
            }
            .padding(.bottom, 74)

            OracleTabBar(selectedTab: model.selectedTab, palette: palette) { tab in
                model.selectTab(tab)
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 14)
        }
        .task {
            await model.load(modelContext: modelContext)
        }
    }
}

private struct HistoryTabView: View {
    @ObservedObject var model: OracleAppModel
    let palette: OraclePalette
    let fontStyle: OracleFontStyle

    var body: some View {
        VStack(spacing: 0) {
            OracleHeader(
                title: "历史",
                subtitle: "记录你的每一天",
                palette: palette,
                fontStyle: fontStyle
            )

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    monthBar
                    weekdayRow
                    calendarGrid
                    detailCard

                    if let errorMessage = model.errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 12, design: fontStyle.bodyDesign))
                            .foregroundStyle(palette.textTertiary)
                            .padding(.top, 14)
                            .padding(.horizontal, 20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.bottom, 16)
            }
            .background(palette.backgroundPrimary)
            .clipShape(.rect(cornerRadius: 32))
            .padding(.horizontal, 12)
            .padding(.top, 4)
        }
    }

    private var monthBar: some View {
        HStack {
            Button {
                model.shiftMonth(by: -1)
            } label: {
                Text("‹")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(palette.textTertiary)
                    .frame(width: 28, height: 28)
            }

            Spacer()

            Text(model.currentMonth.formatted(.dateTime.year().month(.wide)))
                .font(.system(size: 13, weight: .medium, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textPrimary)

            Spacer()

            Button {
                model.shiftMonth(by: 1)
            } label: {
                Text("›")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(palette.textTertiary)
                    .frame(width: 28, height: 28)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 8)
    }

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(["日", "一", "二", "三", "四", "五", "六"], id: \.self) { item in
                Text(item)
                    .font(.system(size: 10, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textTertiary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 18)
        .padding(.bottom, 6)
    }

    private var calendarGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 2) {
            ForEach(model.calendarDays) { day in
                CalendarCell(
                    day: day,
                    snapshot: model.snapshots.first(where: { $0.dayKey == day.id }),
                    isSelected: Calendar.current.isDate(day.date, inSameDayAs: model.selectedDate),
                    isToday: Calendar.current.isDateInToday(day.date),
                    palette: palette,
                    fontStyle: fontStyle
                ) {
                    model.selectedDate = day.date
                }
            }
        }
        .padding(.horizontal, 16)
    }

    private var detailCard: some View {
        let snapshot = model.selectedSnapshot

        return VStack(alignment: .leading, spacing: 8) {
            Text(model.selectedDate.formatted(.dateTime.month().day().weekday(.wide)))
                .font(.system(size: 10, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textTertiary)

            if let quote = snapshot?.quote {
                Text(quote.text)
                    .font(.system(size: 13, weight: .regular, design: fontStyle.titleDesign))
                    .foregroundStyle(palette.textPrimary)
                    .lineSpacing(4)

                Text(quote.attribution)
                    .font(.system(size: 10, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            } else {
                Text("这一天还没有可展示的名句记录。当前版本会优先展示今天的真实数据，历史名句会随着 `user_daily_logs` 逐步累积。")
                    .font(.system(size: 12, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textSecondary)
                    .lineSpacing(3)
            }

            Rectangle()
                .fill(palette.borderTertiary)
                .frame(height: 0.5)

            if let almanac = snapshot?.almanac {
                VStack(alignment: .leading, spacing: 4) {
                    AlmanacRow(label: "宜", value: almanac.yi, tint: palette.yi, palette: palette, fontStyle: fontStyle)
                    AlmanacRow(label: "忌", value: almanac.ji, tint: palette.ji, palette: palette, fontStyle: fontStyle)

                    if let weatherLine = snapshot?.weatherLine {
                        Text(weatherLine)
                            .font(.system(size: 10, design: fontStyle.bodyDesign))
                            .foregroundStyle(palette.textTertiary)
                            .padding(.top, 2)
                    }
                }
            } else {
                Text("当天宜忌还没有可展示的数据。")
                    .font(.system(size: 11, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textSecondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(palette.backgroundSecondary)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(palette.borderTertiary, lineWidth: 0.5)
        )
        .clipShape(.rect(cornerRadius: 12))
        .padding(.horizontal, 16)
        .padding(.top, 10)
    }
}

private struct SettingsTabView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject var model: OracleAppModel
    let palette: OraclePalette
    let fontStyle: OracleFontStyle
    let theme: OracleAccentTheme
    @Binding var widgetSize: OracleWidgetSize
    let onThemeChange: (OracleAccentTheme) -> Void
    let onFontChange: (OracleFontStyle) -> Void

    var body: some View {
        VStack(spacing: 0) {
            OracleHeader(title: "设置", subtitle: nil, palette: palette, fontStyle: fontStyle)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    widgetPreviewArea
                    sectionLabel("外观")
                    appearanceSection
                    sectionLabel("今日偏好")
                    moodSection
                    sectionLabel("语料偏好")
                    simpleSection(rows: [
                        ("文学类型", "全部"),
                        ("语言", "中文 + 英文"),
                    ])
                    sectionLabel("同步")
                    simpleSection(rows: [
                        ("Supabase 数据", model.syncStatusText),
                        ("位置权限", model.locationState.statusLabel),
                    ])
                }
                .background(palette.backgroundPrimary)
                .clipShape(.rect(cornerRadius: 32))
                .padding(.horizontal, 12)
                .padding(.top, 4)
                .padding(.bottom, 16)
            }
        }
    }

    private var widgetPreviewArea: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                ForEach(OracleWidgetSize.allCases) { size in
                    Button {
                        widgetSize = size
                    } label: {
                        Text(size.title)
                            .font(.system(size: 10, design: fontStyle.bodyDesign))
                            .foregroundStyle(widgetSize == size ? palette.textPrimary : palette.textTertiary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .overlay(
                                RoundedRectangle(cornerRadius: 5)
                                    .stroke(widgetSize == size ? palette.borderPrimary : palette.borderTertiary, lineWidth: 0.5)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            WidgetPreviewCard(
                snapshot: model.snapshots.first,
                quote: model.latestQuote,
                size: widgetSize,
                palette: palette,
                fontStyle: fontStyle
            )
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(palette.borderTertiary)
                .frame(height: 0.5)
        }
    }

    private var appearanceSection: some View {
        VStack(spacing: 0) {
            HStack {
                Text("主题色")
                    .font(.system(size: 13, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textPrimary)

                Spacer()

                HStack(spacing: 8) {
                    ForEach(OracleAccentTheme.allCases) { themeCase in
                        Button {
                            onThemeChange(themeCase)
                        } label: {
                            Circle()
                                .fill(themeCase.accent)
                                .frame(width: 14, height: 14)
                                .overlay {
                                    if themeCase == theme {
                                        Circle()
                                            .stroke(palette.borderPrimary, lineWidth: 2)
                                            .padding(-2)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)

            divider

            Menu {
                ForEach(OracleFontStyle.allCases) { style in
                    Button(style.label) {
                        onFontChange(style)
                    }
                }
            } label: {
                settingRow(label: "字体", value: fontStyle.label)
            }
            .buttonStyle(.plain)
        }
    }

    private var moodSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            MoodSelector(
                selectedMood: model.selectedMood,
                palette: palette,
                fontStyle: fontStyle
            ) { mood in
                Task {
                    await model.selectMood(mood, modelContext: modelContext)
                }
            }

            Text("切换心情后会重新请求 `daily-quote`，并把结果写入 `log-mood`。")
                .font(.system(size: 10, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textTertiary)
                .lineSpacing(3)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(palette.borderTertiary)
                .frame(height: 0.5)
        }
    }

    private func simpleSection(rows: [(String, String)]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                if index > 0 { divider }
                settingRow(label: row.0, value: row.1)
            }
        }
    }

    private func settingRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 13, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textPrimary)

            Spacer()

            Text(value)
                .font(.system(size: 12, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textTertiary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 11)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, design: fontStyle.bodyDesign))
            .foregroundStyle(palette.textTertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 4)
    }

    private var divider: some View {
        Rectangle()
            .fill(palette.borderTertiary)
            .frame(height: 0.5)
    }
}

private struct MoodSelector: View {
    let selectedMood: QuoteMood?
    let palette: OraclePalette
    let fontStyle: OracleFontStyle
    let onSelect: (QuoteMood?) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 6), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                onSelect(nil)
            } label: {
                HStack {
                    Text("不过滤")
                        .font(.system(size: 11, design: fontStyle.bodyDesign))
                        .foregroundStyle(selectedMood == nil ? palette.textPrimary : palette.textTertiary)

                    Spacer()

                    if selectedMood == nil {
                        Circle()
                            .fill(palette.accent)
                            .frame(width: 6, height: 6)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(selectedMood == nil ? palette.backgroundSecondary : palette.backgroundPrimary)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selectedMood == nil ? palette.borderPrimary : palette.borderTertiary, lineWidth: 0.5)
                )
            }
            .buttonStyle(.plain)

            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(QuoteMood.allCases) { mood in
                    Button {
                        onSelect(mood)
                    } label: {
                        VStack(spacing: 4) {
                            Text(mood.shortLabel)
                                .font(.system(size: 12, weight: .medium, design: fontStyle.bodyDesign))

                            Text(mood.rawValue)
                                .font(.system(size: 8, design: fontStyle.bodyDesign))
                        }
                        .foregroundStyle(selectedMood == mood ? palette.textPrimary : palette.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 42)
                        .background(selectedMood == mood ? palette.backgroundSecondary : palette.backgroundPrimary)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(selectedMood == mood ? palette.borderPrimary : palette.borderTertiary, lineWidth: 0.5)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct OracleHeader: View {
    let title: String
    let subtitle: String?
    let palette: OraclePalette
    let fontStyle: OracleFontStyle

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 20, weight: .medium, design: fontStyle.titleDesign))
                .foregroundStyle(palette.textPrimary)

            if let subtitle {
                Text(subtitle)
                    .font(.system(size: 11, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 32)
        .padding(.top, 20)
        .padding(.bottom, 12)
    }
}

private struct CalendarCell: View {
    let day: CalendarDay
    let snapshot: OracleDaySnapshot?
    let isSelected: Bool
    let isToday: Bool
    let palette: OraclePalette
    let fontStyle: OracleFontStyle
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(day.date.formatted(.dateTime.day()))
                    .font(.system(size: 11, weight: isToday ? .medium : .regular, design: fontStyle.bodyDesign))
                    .foregroundStyle(numberColor)

                Circle()
                    .fill(dotColor)
                    .frame(width: 7, height: 7)
                    .opacity(snapshot == nil ? 0 : 1)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(background)
            .clipShape(.rect(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private var background: Color {
        if isSelected {
            return palette.borderTertiary
        }

        if isToday {
            return palette.backgroundSecondary
        }

        return .clear
    }

    private var dotColor: Color {
        isToday ? palette.accent : palette.textTertiary
    }

    private var numberColor: Color {
        if day.isCurrentMonth {
            return isToday ? palette.textPrimary : palette.textSecondary
        }

        return palette.textTertiary
    }
}

private struct AlmanacRow: View {
    let label: String
    let value: String
    let tint: Color
    let palette: OraclePalette
    let fontStyle: OracleFontStyle

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: fontStyle.bodyDesign))
                .foregroundStyle(tint)

            Text(value)
                .font(.system(size: 11, design: fontStyle.bodyDesign))
                .foregroundStyle(palette.textSecondary)
                .lineLimit(2)
        }
    }
}

private struct WidgetPreviewCard: View {
    let snapshot: OracleDaySnapshot?
    let quote: OracleQuote?
    let size: OracleWidgetSize
    let palette: OraclePalette
    let fontStyle: OracleFontStyle

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if size == .large {
                Text(date.formatted(.dateTime.month().day()))
                    .font(.system(size: 9, design: fontStyle.bodyDesign))
                    .foregroundStyle(palette.textTertiary)
            }

            Text((quote ?? snapshot?.quote)?.text ?? "还没有读取到真实名句")
                .font(.system(size: quoteFontSize, design: fontStyle.titleDesign))
                .foregroundStyle(palette.textPrimary)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)

            if size != .small {
                if let attribution = (quote ?? snapshot?.quote)?.attribution {
                    Text(attribution)
                        .font(.system(size: 9, design: fontStyle.bodyDesign))
                        .foregroundStyle(palette.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                Rectangle()
                    .fill(palette.borderTertiary)
                    .frame(height: 0.5)

                if let almanac = snapshot?.almanac {
                    AlmanacRow(label: "宜", value: almanac.yi, tint: palette.yi, palette: palette, fontStyle: fontStyle)

                    if size == .large {
                        AlmanacRow(label: "忌", value: almanac.ji, tint: palette.ji, palette: palette, fontStyle: fontStyle)

                        HStack(spacing: 4) {
                            ForEach(QuoteMood.allCases) { mood in
                                Text(mood.shortLabel)
                                    .font(.system(size: 8, weight: .medium))
                                    .foregroundStyle(palette.textTertiary)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 18)
                                    .background(palette.backgroundPrimary)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .stroke(palette.borderTertiary, lineWidth: 0.5)
                                    )
                            }
                        }
                        .padding(.top, 4)
                    }
                }
            }
        }
        .padding(cardPadding)
        .frame(maxWidth: size == .small ? 190 : .infinity, minHeight: previewHeight, alignment: .topLeading)
        .background(palette.backgroundSecondary)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(palette.borderTertiary, lineWidth: 0.5)
        )
        .clipShape(.rect(cornerRadius: 16))
    }

    private var quoteFontSize: CGFloat {
        switch size {
        case .large: return 11
        case .medium: return 10
        case .small: return 9.5
        }
    }

    private var date: Date {
        snapshot?.date ?? .now
    }

    private var previewHeight: CGFloat {
        switch size {
        case .large: return 220
        case .medium: return 122
        case .small: return 110
        }
    }

    private var cardPadding: CGFloat {
        switch size {
        case .large: return 10
        case .medium: return 8
        case .small: return 6
        }
    }
}

private struct OracleTabBar: View {
    let selectedTab: OracleTab
    let palette: OraclePalette
    let onSelect: (OracleTab) -> Void

    var body: some View {
        HStack(spacing: 0) {
            item(tab: .history, label: "历史")
            item(tab: .settings, label: "设置")
        }
        .padding(.vertical, 8)
        .background(palette.backgroundPrimary)
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(palette.borderTertiary, lineWidth: 0.5)
        )
        .clipShape(.rect(cornerRadius: 18))
    }

    private func item(tab: OracleTab, label: String) -> some View {
        Button {
            onSelect(tab)
        } label: {
            VStack(spacing: 4) {
                tab == .history ? AnyView(CalendarGlyph(color: tabColor(tab))) : AnyView(SettingsGlyph(color: tabColor(tab)))

                Text(label)
                    .font(.system(size: 10))
                    .foregroundStyle(tabColor(tab))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private func tabColor(_ tab: OracleTab) -> Color {
        selectedTab == tab ? palette.textPrimary : palette.textTertiary
    }
}

private struct CalendarGlyph: View {
    let color: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3)
                .stroke(color, lineWidth: 1)
                .frame(width: 18, height: 18)

            VStack(spacing: 0) {
                Rectangle().fill(color).frame(width: 14, height: 1)
                Spacer()
            }
            .frame(width: 18, height: 18)

            HStack(spacing: 5) {
                Rectangle().fill(color).frame(width: 1, height: 4)
                Rectangle().fill(color).frame(width: 1, height: 4)
            }
            .offset(y: -5)
        }
        .frame(width: 22, height: 22)
    }
}

private struct SettingsGlyph: View {
    let color: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(color, lineWidth: 1)
                .frame(width: 18, height: 18)

            Path { path in
                path.move(to: CGPoint(x: 9, y: 4.5))
                path.addLine(to: CGPoint(x: 9, y: 9))
                path.addLine(to: CGPoint(x: 12.5, y: 12.5))
            }
            .stroke(color, style: StrokeStyle(lineWidth: 1, lineCap: .round))
            .frame(width: 18, height: 18)
        }
        .frame(width: 22, height: 22)
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [CachedDayRecord.self], inMemory: true)
}
