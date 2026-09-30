import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { mapRequest, requestErrorMessage } from '../src/requests/model.js'
import { demoRequests } from '../src/data/requests.js'
import { authorityRequests } from '../src/data/authorityRequests.js'

test('existing detail panels and modals render real and demo data; request states are explicit', async () => {
  const server = await createServer({ envDir: false, cacheDir: 'node_modules/.vite-request-tests', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  const previousWindow = globalThis.window
  try {
    globalThis.window = { sessionStorage: { getItem: () => null, removeItem() {} } }
    const load = async path => (await server.ssrLoadModule('/src/components/' + path)).default
    const CitizenDetails = await load('dashboard/RequestDetails.jsx')
    const AuthorityDetails = await load('authority/AuthorityRequestDetails.jsx')
    const CitizenList = await load('dashboard/RequestList.jsx')
    const AuthorityList = await load('authority/AuthorityRequestList.jsx')
    const Controls = await load('requests/RequestDataControls.jsx')
    const CreateDialog = await load('requests/CreateRequestDialog.jsx')
    const Gallery = await load('requests/RequestPhotoGallery.jsx')
    const Previews = await load('requests/PhotoPreviews.jsx')
    const { AssignResponsibleModal, ChangeStatusModal } = await server.ssrLoadModule('/src/components/authority/AuthorityModals.jsx')
    const { AuthContext } = await server.ssrLoadModule('/src/auth/context.js')
    const render = (component, props) => renderToStaticMarkup(h(MemoryRouter, {}, h(AuthContext.Provider, { value: { account: { status: 'authenticated', user: { id: 'citizen' } } } }, h(component, props))))
    const row = { id: 'real-id', request_number: 'A-201', user_id: 'citizen', type: 'idea', title: 'Новая идея', description: 'Описание из базы', category: null, address: null, status: 'needs_info', priority: null, assigned_to: null, created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T11:00:00Z' }
    for (const status of ['new', 'reviewing', 'in_progress', 'needs_info', 'resolved', 'rejected']) {
      const request = mapRequest({ ...row, status })
      for (const component of [CitizenDetails, AuthorityDetails]) {
        const html = render(component, { request, updates: [], confirmed: false })
        assert.match(html, /Описание из базы/)
        assert.match(html, /A-201/)
        assert.match(html, /Создано:/)
        assert.match(html, /Данные из базы/)
        assert.match(html, /Местоположение не указано/)
        assert.doesNotMatch(html, /Демонстрационные данные|Приоритет ИИ|12 подтверждений/)
      }
      const statusModal = render(ChangeStatusModal, { request, saveError: 'Ошибка сохранения', busy: true })
      assert.match(statusModal, /Сохраняем…/)
      assert.match(statusModal, /Ошибка сохранения/)
      assert.match(statusModal, /Отклонено/)
      assert.match(statusModal, /Комментарии и загрузка фотографий пока недоступны/)
      assert.doesNotMatch(statusModal, /type="file"/)
      assert.match(render(AssignResponsibleModal, { request }), /Сохраняется только имя или название/)
    }
    assert.match(render(CitizenDetails, { request: demoRequests[0], updates: [] }), /Демонстрационные данные/)
    assert.match(render(AuthorityDetails, { request: authorityRequests[0] }), /Демонстрационные данные/)
    assert.match(render(AssignResponsibleModal, { request: authorityRequests[0] }), /Срок ответа/)
    assert.match(render(ChangeStatusModal, { request: authorityRequests[0] }), /type="file"/)
    assert.match(render(CreateDialog, { type: 'idea', description: 'Текст черновика' }), /Текст черновика/)
    assert.match(render(CreateDialog, { type: 'problem', description: '<script>alert(1)</script>' }), /&lt;script&gt;/)
    assert.match(render(CreateDialog, { type: 'idea', description: 'Текст', files: [{ name: 'photo.jpg' }] }), /Фото: 1 \/ 5/)
    assert.match(render(Previews, { files: [{ name: 'photo.jpg', lastModified: 1 }] }), /Убрать фотографию 1/)
    assert.match(render(Gallery, { state: { photos: [], loading: true } }), /Загружаем фотографии/)
    assert.match(render(Gallery, { state: { photos: [], error: 'Ошибка фото' } }), /Повторить/)
    assert.match(render(Gallery, { state: { photos: [] } }), /Фотографии не прикреплены/)
    const gallery = render(Gallery, { state: { photos: [{ id: 'photo', kind: 'citizen', url: 'https://photos.invalid/signed/fixture' }] } })
    assert.match(gallery, /Фото жителя/)
    assert.match(gallery, /Открыть фотографию 1/)
    assert.doesNotMatch(gallery, /Демо|Фото после/)
    assert.match(render(Controls, { mode: 'real', loading: true, count: 0 }), /Загружаем обращения/)
    assert.match(render(Controls, { mode: 'real', error: requestErrorMessage({ code: 'PGRST205' }), count: 0 }), /role="alert"/)
    assert.match(render(Controls, { mode: 'real', citizen: true, count: 0 }), /Создайте первое обращение/)
    assert.match(render(Controls, { mode: 'demo', count: 0 }), /изменения только на этой странице/)
    assert.match(render(CitizenList, { requests: [], query: '', filter: 'all' }), /Обращения не найдены/)
    assert.match(render(AuthorityList, { requests: [], allRequests: [], filters: { query: '', status: 'all', category: '', area: '', priority: '' }, mode: 'real' }), /Обращения не найдены/)
  } finally { globalThis.window = previousWindow; await server.close() }
})
