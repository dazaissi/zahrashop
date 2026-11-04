import { createContext, useContext, useState } from 'react'
import Toast from '../components/ui/Toast'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'

const UIContext = createContext()

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null)
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', resolve: null })
  const [promptState, setPromptState] = useState({ isOpen: false, title: '', message: '', defaultValue: '', resolve: null })
  const [promptValue, setPromptValue] = useState('')

  const showToast = (message, type = 'success') => setToast({ message, type })

  const showConfirm = (title, message) => {
    return new Promise((resolve) => setConfirmState({ isOpen: true, title, message, resolve }))
  }

  const showPrompt = (title, message, defaultValue = '') => {
    setPromptValue(defaultValue)
    return new Promise((resolve) => setPromptState({ isOpen: true, title, message, defaultValue, resolve }))
  }

  const handleConfirm = (value) => {
    if (confirmState.resolve) confirmState.resolve(value)
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }

  const handlePromptSubmit = (e) => {
    e.preventDefault()
    if (promptState.resolve) promptState.resolve(promptValue)
    setPromptState(prev => ({ ...prev, isOpen: false }))
  }

  const handlePromptCancel = () => {
    if (promptState.resolve) promptState.resolve(null)
    setPromptState(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <UIContext.Provider value={{ showToast, showConfirm, showPrompt }}>
      {children}
      
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      
      {confirmState.isOpen && (
        <Modal isOpen={true} onClose={() => handleConfirm(false)} title={confirmState.title}>
          <p style={{ marginBottom: 24, color: 'var(--text-main)', fontSize: 15 }}>{confirmState.message}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => handleConfirm(false)} style={{ flex: 1, justifyContent: 'center' }}>Batal</Button>
            <Button variant="danger" onClick={() => handleConfirm(true)} style={{ flex: 1, justifyContent: 'center' }}>Ya, Lanjutkan</Button>
          </div>
        </Modal>
      )}

      {promptState.isOpen && (
        <Modal isOpen={true} onClose={handlePromptCancel} title={promptState.title}>
          <p style={{ marginBottom: 16, color: 'var(--text-main)', fontSize: 15 }}>{promptState.message}</p>
          <form onSubmit={handlePromptSubmit}>
            <input type="text" value={promptValue} onChange={e => setPromptValue(e.target.value)} style={{ width: '100%', marginBottom: 24, fontSize: 18, padding: '12px' }} autoFocus />
            <div style={{ display: 'flex', gap: 12 }}>
              <Button type="button" variant="secondary" onClick={handlePromptCancel} style={{ flex: 1, justifyContent: 'center' }}>Batal</Button>
              <Button type="submit" variant="primary" style={{ flex: 1, justifyContent: 'center' }}>Simpan</Button>
            </div>
          </form>
        </Modal>
      )}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)