import SwiftUI

struct SettingsTab: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.lg) {
                widgetPreviewSection
            }
            .padding(Spacing.md)
        }
        .background(AppColors.backgroundPrimary)
    }

    private var widgetPreviewSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("小组件预览")
                .font(.navTitle)
                .foregroundStyle(AppColors.textPrimary)

            VStack(spacing: Spacing.lg) {
                widgetItem("小 · 2×2") { WidgetPreviewSmall().frame(width: 170, height: 170) }
                widgetItem("长条 · 4×2") { WidgetPreviewMedium() }
                widgetItem("大 · 4×4") { WidgetPreviewLarge() }
            }
        }
    }
    private func widgetItem<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: Spacing.xs) {
            content()
        }
    }
}

#Preview {
    SettingsTab()
}
