// UI metadata only. These identifiers can later map to authenticated roles.
// Selecting a card does not grant permissions or create a session.
export const roleOptions = [
  {
    id: 'citizen', title: 'Житель',
    description: 'Сообщайте о городских проблемах, предлагайте идеи и следите за их решением.',
    features: ['Создание обращений и идей', 'История статусов', 'Уведомления', 'Карта города'],
    action: 'Продолжить как житель', destination: '/dashboard',
  },
  {
    id: 'authority', title: 'Представитель госоргана',
    description: 'Рассматривайте обращения жителей, назначайте ответственных и обновляйте статусы.',
    features: ['Входящие обращения', 'Поиск и фильтры', 'Назначение ответственных', 'Изменение статусов'],
    action: 'Продолжить как сотрудник',
    destination: '/authority',
    message: 'Кабинет госоргана будет подключён на следующем этапе',
  },
]
