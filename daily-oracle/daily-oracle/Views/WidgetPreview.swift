import SwiftUI

private let previewRadius: CGFloat = 22

private struct WidgetCard<Content: View>: View {
    let aspectRatio: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(Spacing.md)
            .frame(maxWidth: .infinity)
            .aspectRatio(aspectRatio, contentMode: .fit)
            .background(Color("backgroundPrimary"))
            .clipShape(RoundedRectangle(cornerRadius: previewRadius))
            .overlay(
                RoundedRectangle(cornerRadius: previewRadius)
                    .stroke(Color("borderSecondary"), lineWidth: 0.5)
            )
    }
}

private struct YiJiRow: View {
    let colorName: String
    let text: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color(colorName))
                .frame(width: 4, height: 16)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color("textSecondary"))
                .lineLimit(1)
        }
    }
}

// MARK: - Small 2×2

struct WidgetPreviewSmall: View {
    var body: some View {
        WidgetCard(aspectRatio: 1) {
            VStack(spacing: Spacing.md) {
                Spacer()
                Text("窗外一方灰暗的天空上，纷纷扬扬飘浮着鹅毛大雪。四周静寂得令人难以置信。岛村心里空空的，他睡眼惺忪地眺望着雪景。")
                    .font(.system(size: 17, weight: .regular, design: .serif))
                    .foregroundStyle(Color("textPrimary"))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                Spacer()
            }
        }
    }
}

// MARK: - Medium 4×2

struct WidgetPreviewMedium: View {
    var body: some View {
        WidgetCard(aspectRatio: 2.12) {
            HStack(spacing: 0) {
                Text("窗外一方灰暗的天空上，纷纷扬扬飘浮着鹅毛大雪。四周静寂得令人难以置信。岛村心里空空的，他睡眼惺忪地眺望着雪景。")
                    .font(.system(size: 15, design: .serif))
                    .foregroundStyle(Color("textPrimary"))
                    .frame(maxWidth: .infinity, alignment: .leading)

                Divider()
                    .padding(.horizontal, Spacing.md)

                VStack(alignment: .leading, spacing: Spacing.md) {
                    YiJiRow(colorName: "yi", text: "宜静思")
                    YiJiRow(colorName: "ji", text: "忌急躁")
                }
                .fixedSize(horizontal: true, vertical: false)
            }
        }
    }
}

// MARK: - Large 4×4

struct WidgetPreviewLarge: View {
    var body: some View {
        WidgetCard(aspectRatio: 0.955) {
            VStack(alignment: .leading, spacing: 0) {
                Text("4月3日")
                    .font(.system(size: 13))
                    .foregroundStyle(Color("textTertiary"))
                    .padding(.bottom, Spacing.sm)

                Text("窗外一方灰暗的天空上，纷纷扬扬飘浮着鹅毛大雪。四周静寂得令人难以置信。岛村心里空空的，他睡眼惺忪地眺望着雪景。")
                    .font(.system(size: 17, design: .serif))
                    .foregroundStyle(Color("textPrimary"))

                Text("— 加西亚·马尔克斯")
                    .font(.system(size: 13))
                    .foregroundStyle(Color("textTertiary"))
                    .padding(.top, Spacing.sm)

                Spacer()

                Divider()
                    .padding(.bottom, Spacing.md)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    YiJiRow(colorName: "yi", text: "宜阅读，适合沉浸文字世界")
                    YiJiRow(colorName: "ji", text: "忌焦虑，放下不必要的担忧")
                }

                HStack(spacing: Spacing.sm) {
                    ForEach(["calm", "happy", "sad", "anxious", "philosophical"], id: \.self) { _ in
                        RoundedRectangle(cornerRadius: Radius.sm)
                            .fill(Color("backgroundSecondary"))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.sm)
                                    .stroke(Color("borderTertiary"), lineWidth: 0.5)
                            )
                            .frame(height: 32)
                    }
                }
                .padding(.top, Spacing.md)
            }
        }
    }
}

#Preview("Small") { WidgetPreviewSmall().padding() }
#Preview("Medium") { WidgetPreviewMedium().padding() }
#Preview("Large") { WidgetPreviewLarge().padding() }
