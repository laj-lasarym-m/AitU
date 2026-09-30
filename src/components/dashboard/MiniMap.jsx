import { MapPin } from 'lucide-react'

export default function MiniMap({ landmark, street = 'ул. Абая' }) {
  return (
    <div className="db-mini-map" role="img" aria-label={`Схематичное место обращения: ${street === 'ул. Абая' ? 'улица Абая' : street}, ${landmark}. Демонстрационная карта.`}>
      <svg className="db-map-drawing" viewBox="0 0 420 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="420" height="180" fill="var(--db-map-ground)" />
        <g transform="rotate(-20 210 90)">
          <g fill="var(--db-map-building)">
            <path d="M-10-40h53v80h-53zM62-30h37v45H62zM118-30h46v64h-46zM181-30h55v73h-55zM265-30h42v48h-42zM325-30h55v70h-55zM398-30h48v76h-48z" />
            <path d="M-9 56h62v41H-9zM72 43h53v50H72zM144 51h68v40h-68zM242 37h52v54h-52zM315 55h66v35h-66zM396 65h57v38h-57z" />
            <path d="M154 128h81v77h-81zM261 127h59v80h-59zM345 128h60v70h-60z" />
          </g>
          <rect x="-20" y="128" width="155" height="90" rx="9" fill="var(--db-map-park)" />
          <g stroke="var(--db-map-street)" strokeWidth="7"><path d="M-40 111H470M54-50v290M226-50v290M307-50v290M389-50v290M-40 30H470" /></g>
          <path d="M-40 111H470" stroke="var(--db-map-street)" strokeWidth="17" />
          <path d="M-40 111H470" stroke="var(--db-map-ground)" strokeWidth="2" />
        </g>
      </svg>
      <span className="db-map-street-label">{street}</span><span className="db-map-landmark">{landmark}</span>
      <div className="db-map-pin"><MapPin size={33} fill="currentColor" strokeWidth={1.7} /><span>Место обращения</span></div>
    </div>
  )
}
