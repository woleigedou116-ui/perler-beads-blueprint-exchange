export const messages = {
  "zh-CN": {
    appName: "拼豆图纸转换工具",
    localFirst: "图片、项目文件和识别结果都在本机处理。",
    prototypeRouteName: "桌面工作台视觉模型",
  },
  "en-US": {
    appName: "Perler Beads Blueprint Converter",
    localFirst: "Images, project files, and recognition results stay local.",
    prototypeRouteName: "Desktop workbench visual prototype",
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["zh-CN"];
