import { beforeEach, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Admin from '../src/views/Admin.vue'
import { api } from '../src/api'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { section: 'activities' } }),
}))
vi.mock('../src/stores/auth', () => ({
  useAuth: () => ({ user: { id: '1' }, isAdmin: true }),
}))
vi.mock('../src/api', async (original) => ({
  ...(await original<typeof import('../src/api')>()),
  api: vi.fn(),
}))

const all = [
  { id: '2', title: '雨天折扣', productName: '轻便雨伞' },
  { id: '1', title: '杯子专场', productName: '保温杯' },
]
const lastActivityRequest = () => {
  const call = vi
    .mocked(api)
    .mock.calls.filter(([, path]) => path.startsWith('/admin/seckill-activities?'))
    .at(-1)!
  return new URL(call[1], 'http://localhost').searchParams
}

beforeEach(() => {
  vi.mocked(api).mockReset()
  vi.mocked(api).mockResolvedValue({ items: all, total: 2, page: 1, size: 10 })
})

test('活动搜索发送关键词、重置页码并展示筛选结果，清空后恢复列表', async () => {
  const wrapper = mount(Admin, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ElTable: {
          props: ['data'],
          template: '<div data-testid="activity-results">{{ JSON.stringify(data) }}</div>',
        },
        ElPagination: {
          template: `<button data-testid="next-page" @click="$emit('update:currentPage', 2); $emit('current-change', 2)">下一页</button>`,
        },
        ElTableColumn: true,
        ElDialog: { template: '<div />' },
        ElButton: true,
        ElForm: true,
        ElFormItem: true,
        ElInput: true,
        ElInputNumber: true,
        ElSelect: true,
        ElOption: true,
        ElDatePicker: true,
        ElTag: true,
      },
    },
  })
  try {
    await flushPromises()
    const input = wrapper.get('input[aria-label="管理搜索"]')
    expect(input.attributes('placeholder')).toBe('搜索活动标题或商品名称')
    await wrapper.get('[data-testid="next-page"]').trigger('click')
    await flushPromises()
    expect(lastActivityRequest().get('page')).toBe('2')

    vi.mocked(api).mockResolvedValue({ items: [all[0]], total: 1, page: 1, size: 10 })
    await input.setValue('雨伞')
    await wrapper.get('.admin-toolbar button').trigger('click')
    await flushPromises()
    expect(lastActivityRequest().get('keyword')).toBe('雨伞')
    expect(lastActivityRequest().get('page')).toBe('1')
    expect(wrapper.get('[data-testid="activity-results"]').text()).toContain('雨天折扣')
    expect(wrapper.get('[data-testid="activity-results"]').text()).not.toContain('杯子专场')
    expect(wrapper.get('.admin-toolbar').text()).toContain('共 1 条')

    vi.mocked(api).mockResolvedValue({ items: all, total: 2, page: 1, size: 10 })
    await input.setValue('')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(lastActivityRequest().get('keyword')).toBe('')
    expect(wrapper.get('[data-testid="activity-results"]').text()).toContain('杯子专场')
    expect(wrapper.get('.admin-toolbar').text()).toContain('共 2 条')
  } finally {
    wrapper.unmount()
  }
})
