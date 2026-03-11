import {
  FileText,
  Eye,
  X,
  Tv,
  Calendar,
  Hash,
  Play,
  Clipboard,
  Check,
  CircleCheck,
  CircleX,
  Info,
  Library,
  Clock,
  Star,
  BarChart,
  Settings,
  Search,
  RefreshCw,
  Lightbulb,
  Flame,
  Database,
  Upload,
  Download,
  Trash,
  Inbox,
  Sparkles,
  Tag,
  Copy,
  Text,
  Timer,
  Languages,
  Captions,
} from "lucide-static";

const style = (svg: string, size?: number): string => {
  let s = svg.replace(
    "<svg",
    `<svg style="display:inline-block;vertical-align:middle;flex-shrink:0"`,
  );
  if (size) {
    s = s
      .replace(/width="\d+"/, `width="${size}"`)
      .replace(/height="\d+"/, `height="${size}"`);
  }
  return s;
};

const filled = (svg: string): string =>
  svg.replace("<svg", '<svg fill="currentColor"');

export const icons = {
  fileText: style(FileText),
  eye: style(Eye),
  x: style(X, 18),
  tv: style(Tv),
  calendar: style(Calendar),
  hash: style(Hash),
  play: style(Play),
  clipboard: style(Clipboard),
  check: style(Check),
  circleCheck: style(CircleCheck),
  circleX: style(CircleX),
  info: style(Info),
  library: style(Library),
  clock: style(Clock),
  star: style(Star),
  starFilled: filled(style(Star)),
  barChart: style(BarChart),
  settings: style(Settings),
  search: style(Search),
  refreshCw: style(RefreshCw),
  lightbulb: style(Lightbulb),
  flame: style(Flame),
  database: style(Database),
  upload: style(Upload),
  download: style(Download),
  trash: style(Trash),
  inbox: style(Inbox),
  sparkles: style(Sparkles),
  tag: style(Tag),
  copy: style(Copy),
  text: style(Text),
  timer: style(Timer),
  translate: style(Languages),
  subtitles: style(Captions),
} as const;
