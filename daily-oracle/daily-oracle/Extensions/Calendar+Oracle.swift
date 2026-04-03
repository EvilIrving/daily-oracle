//
//  Calendar+Oracle.swift
//  daily-oracle
//

import Foundation

extension Calendar {
    /// 全应用统一的公历与日界，避免受用户区域设置里其它历法影响。
    static let oracle = Calendar(identifier: .gregorian)
}
