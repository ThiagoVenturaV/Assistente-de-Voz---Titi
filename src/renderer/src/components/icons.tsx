import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PlusIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>
)
export const SearchIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></IconBase>
)
export const SettingsIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.4.39.75.6 1 .29.34.68.48 1.1.5h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" /></IconBase>
)
export const MessageIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></IconBase>
)
export const MicIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" /></IconBase>
)
export const LiveIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M4 9v6M8 6v12M12 9v6M16 4v16M20 8v8" /></IconBase>
)
export const SendIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="m4 12 16-8-6 16-2.5-6.5L4 12Z" /><path d="M11.5 13.5 20 4" /></IconBase>
)
export const PanelIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></IconBase>
)
export const CloseIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>
)
export const MinimizeIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M6 12h12" /></IconBase>
)
export const MaximizeIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><rect x="6" y="6" width="12" height="12" rx="1" /></IconBase>
)
export const MoreIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></IconBase>
)
export const TrashIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></IconBase>
)
export const SparklesIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3ZM18.5 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM6 14l.9 2.6 2.6.9-2.6.9L6 21l-.9-2.6-2.6-.9 2.6-.9L6 14Z" /></IconBase>
)
export const ChevronIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="m9 18 6-6-6-6" /></IconBase>
)
export const CheckIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="m5 12 4 4L19 6" /></IconBase>
)
export const MonitorIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></IconBase>
)
export const ShieldIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><path d="M12 3 4.5 6v5.5c0 4.7 3.1 8 7.5 9.5 4.4-1.5 7.5-4.8 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></IconBase>
)
export const CpuIcon = (props: IconProps): React.JSX.Element => (
  <IconBase {...props}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3M10 10h4v4h-4z" /></IconBase>
)
