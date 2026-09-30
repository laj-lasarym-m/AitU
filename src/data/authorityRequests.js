import { demoRequests } from './requests.js'

export const authorityStatuses = ['Новая', 'На рассмотрении', 'Нужны уточнения', 'В работе', 'Завершена']
export const authorityStatusFilters = [
  { value: 'all', label: 'Все' }, { value: 'Новая', label: 'Новые' },
  { value: 'В работе', label: 'В работе' }, { value: 'Завершена', label: 'Завершённые' },
]
export const authorityServices = {
  'Городское освещение': ['Бектур А.', 'Алия Н.'],
  'Городской транспорт': ['Марат К.', 'Динара С.'],
  'Городское благоустройство': ['Айдана М.', 'Ерлан Т.'],
  'Дорожная служба': ['Арман Б.', 'Жанна О.'],
}

// A-104 starts from the exact citizen demo record. Authority edits stay local.
export const authorityRequests = [
  {
    ...demoRequests[0], priority: 'Высокий', category: 'Городская инфраструктура', subcategory: 'Освещение',
    area: 'Центральный', source: 'Веб-приложение', employee: '', deadline: '2026-10-02', photos: [], photoSlots: 3,
    reason: 'Проблема связана с безопасностью пешеходов в тёмное время суток.',
    history: [
      { time: '29 сентября, 10:20', title: 'Обращение получено', text: 'Обращению присвоен номер A-104.' },
      { time: '29 сентября, 10:28', title: 'Категория определена системой', text: 'Городская инфраструктура → Освещение' },
      { time: '29 сентября, 10:40', title: 'Передано специалисту', text: 'Маршрут: Городское освещение.' },
      { time: '29 сентября, 11:05', title: 'Статус изменён на «В работе»', text: 'Проверяем участок. О результатах сообщим здесь.' },
    ],
  },
  {
    ...demoRequests[1], address: 'ул. Момышулы', priority: 'Средний', category: 'Транспорт', subcategory: 'Остановки',
    area: 'Центральный', source: 'Веб-приложение', employee: '', deadline: '2026-10-05', photos: [], photoSlots: 2,
    reason: 'Предложение улучшает доступность информации о городском транспорте.',
  },
  {
    ...demoRequests[2], address: 'ул. Кабанбай батыра', priority: 'Низкий', category: 'Доступная среда', subcategory: 'Доступность зданий',
    area: 'Центральный', source: 'Веб-приложение', employee: '', deadline: '2026-10-03', photos: [], photoSlots: 2,
    reason: 'Для оценки входной группы нужны уточнения и фотография участка.',
  },
  {
    id: 'A-107', title: 'Ямы на дороге', type: 'problem', date: '28 сентября', address: 'ул. Шакарима', landmark: 'Перекрёсток',
    status: 'Новая', priority: 'Высокий', category: 'Дороги', subcategory: 'Дорожное покрытие', area: 'Заречный',
    source: 'Веб-приложение', service: 'Дорожная служба', employee: '', deadline: '2026-10-02', confirmations: 8, related: 3,
    description: 'На дороге появились глубокие ямы. Водители вынуждены объезжать повреждённый участок. Просим проверить покрытие и провести ремонт.',
    reason: 'Повреждение покрытия может создавать опасность для участников дорожного движения.',
    photos: [], photoSlots: 2, history: [{ time: '28 сентября, 15:30', title: 'Обращение получено', text: 'Ожидает рассмотрения сотрудником.' }],
  },
  {
    id: 'A-108', title: 'Уборка территории', type: 'problem', date: '27 сентября', address: 'мкр. Центральный', landmark: 'Жилой квартал',
    status: 'В работе', priority: 'Средний', category: 'Благоустройство', subcategory: 'Уборка', area: 'Центральный',
    source: 'Веб-приложение', service: 'Городское благоустройство', employee: 'Айдана М.', deadline: '2026-10-01', confirmations: 6, related: 2,
    description: 'Рядом с контейнерной площадкой скопился мусор. Просим организовать уборку территории и проверить график вывоза.',
    reason: 'Требуется плановая уборка общественной территории.',
    photos: [], photoSlots: 1, history: [{ time: '27 сентября, 09:10', title: 'Обращение получено', text: 'Обращение зарегистрировано.' }, { time: '28 сентября, 12:00', title: 'Статус изменён на «В работе»', text: 'Заявка передана службе благоустройства.' }],
  },
]

export function filterAuthorityRequests(requests, { query = '', status = 'all', category = '', area = '', priority = '' }) {
  const search = query.trim().toLocaleLowerCase('ru')
  return requests.filter(request =>
    `${request.id} ${request.title} ${request.address}`.toLocaleLowerCase('ru').includes(search) &&
    (status === 'all' || request.status === status) &&
    (!category || request.category === category) && (!area || request.area === area) && (!priority || request.priority === priority),
  )
}

export function updateAuthorityRequest(requests, id, change, time = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date())) {
  return requests.map(request => {
    if (request.id !== id) return request
    if (change.kind === 'assignment') {
      return { ...request, service: change.service, employee: change.employee, deadline: change.deadline,
        history: [...request.history, { time, title: 'Назначен ответственный', text: `${change.employee} · ${change.service}` }] }
    }
    if (change.kind === 'status' && authorityStatuses.includes(change.status)) {
      return { ...request, status: change.status,
        photos: change.photo ? [...request.photos, change.photo] : request.photos,
        history: [...request.history, { time, title: `Статус изменён на «${change.status}»`, text: change.comment.trim(), photo: change.photo ?? null }] }
    }
    return request
  })
}

export function formatAuthorityDate(date) {
  return date ? new Intl.DateTimeFormat('ru-RU').format(new Date(`${date}T12:00:00`)) : 'Не указан'
}
