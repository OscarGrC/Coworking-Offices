import { useState, useEffect } from "react"
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import type { Empresa } from '../interfaces/Empresa'
import type { Historic } from "../interfaces/Historic"
import { Modalidad } from "../enums/Modalidad"
import { FaArrowLeft } from "react-icons/fa"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/button/button"
import { PopupText } from "../components/popupText/popupText"
import * as styles from '../common/styles/formStyles'
import * as color from '../common/styles/colors'
import { db } from "../firebaseConfig"
import { doc, getDoc, setDoc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore"
import { useAuth } from "../common/AuthContext"
import { toast } from 'react-toastify'


export const FormInactive = () => {

    const navigate = useNavigate()
    const empresaSeleccionada = useSelector((state: RootState) => state.empresas.empresaSeleccionada)
    const { user } = useAuth()
    const [isEditing, setIsEditing] = useState(false)
    const [showPopup, setShowPopup] = useState(false)
    const [company, setCompany] = useState<Empresa>({
        id: '',
        razon_social: '',
        email: [],
        fecha_inicio: '',
        fecha_renovacion: '',
        modalidad: Modalidad.trimestral,
        myBusiness: false,
        pendiente_pago: false,
        renovacion: false,
        contacto: '',
        telefono_contacto: [],
        titular: '',
        telefono_titular: '',
        comentarios: '',
        logo: ''
    })
    const [originalCompany, setOriginalCompany] = useState<Empresa | null>(null)
    const [telefono, setTelefono] = useState('')
    const [email, setEmail] = useState('')
    const nombresMeses = [
        'enero', 'febrero', 'marzo', 'abril',
        'mayo', 'junio', 'julio', 'agosto',
        'septiembre', 'octubre', 'noviembre', 'diciembre',
    ]
    const [historicRows, setHistoricRows] = useState<Historic[]>([])
    const [showHistoricRows, setShowHistoricRows] = useState(false)

    useEffect(() => {
        if (empresaSeleccionada) {
            setCompany(empresaSeleccionada)
            setOriginalCompany(empresaSeleccionada)
        }
    }, [empresaSeleccionada])
    useEffect(() => {
        if (!company.fecha_inicio) return

        const [dd, mm, yyyy] = company.fecha_inicio.split('-')
        const ym = `${yyyy}-${mm}`

        const addedMonths =
            company.modalidad === Modalidad.trimestral ? 2 :
                company.modalidad === Modalidad.semestral ? 5 :
                    11

        const renewalYm = addMonthsToYYYYMM(ym, addedMonths)
        const fechaRenovacionCompleta = getLastDayOfMonth(renewalYm)

        setCompany(prev => ({
            ...prev,
            fecha_renovacion: fechaRenovacionCompleta
        }))
    }, [company.fecha_inicio, company.modalidad])

    const handleTelefonoChange = (e: React.ChangeEvent<HTMLInputElement>) => setTelefono(e.target.value)
    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)
    const handleAddTelefono = () => {
        const trimmedPhone = telefono.trim()
        if (!isValidPhone(trimmedPhone)) {
            toast.error("Introduce un teléfono válido con al menos 9 dígitos (solo números, espacios y '+').")
            return
        }

        setCompany(prev => ({
            ...prev,
            telefono_contacto: [
                ...(Array.isArray(prev.telefono_contacto) ? prev.telefono_contacto : []),
                trimmedPhone
            ]
        }))
        setTelefono('')
    }
    const handleAddEmail = () => {
        const trimmedEmail = email.trim()
        if (!isValidEmail(trimmedEmail)) {
            toast.error("Introduce un correo electrónico válido.")
            return
        }

        setCompany(prev => ({
            ...prev,
            email: [
                ...(Array.isArray(prev.email) ? prev.email : []),
                trimmedEmail
            ]
        }))
        setEmail('')
    }
    const handleRemoveTelefono = (index: number) => {
        setCompany(prev => ({
            ...prev,
            telefono_contacto: prev.telefono_contacto.filter((_, i) => i !== index)
        }))
    }
    const handleRemoveEmail = (index: number) => {
        setCompany(prev => ({
            ...prev,
            email: prev.email.filter((_, i) => i !== index)
        }))
    }

    const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setCompany(prev => ({ ...prev, [name]: value }))
    }
    const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setCompany(prev => ({ ...prev, [name]: value }))
    }
    const handleFechaInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const ym = e.target.value
        const fechaInicioCompleta = `01-${ym.split('-')[1]}-${ym.split('-')[0]}`
        setCompany(prev => ({ ...prev, fecha_inicio: fechaInicioCompleta }))
    }
    const handleModalidadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const modalidad = e.target.value as Modalidad
        const isMyBusiness = modalidad === Modalidad.myBusiness
        setCompany(prev => ({ ...prev, modalidad, myBusiness: isMyBusiness }))
    }
    const handleCheckboxChange = () => {
        if (company.renovacion) {
            setCompany(prev => ({ ...prev, renovacion: false }))
            setShowPopup(true)
        } else {
            setCompany(prev => ({ ...prev, renovacion: true }))
            setShowPopup(false)
        }
    }
    const handlePopupCancel = () => {
        setCompany(prev => ({ ...prev, renovacion: true }))
        setShowPopup(false)
    }
    const handlePopupSave = async (text: string) => {
        if (!originalCompany) return

        const cambios = {
            "Motivo Baja": {
                antes: "",
                despues: text
            }
        }

        try {
            await saveHistoricalChanges(originalCompany.id, cambios)
            toast.success("Motivo de baja guardado en el historial.")
        } catch (error) {
            toast.error("Error guardando motivo de baja.")
        }
        setShowPopup(false)
    }
    const addMonthsToYYYYMM = (yyyymm: string, monthsToAdd: number): string => {
        const [yearStr, monthStr] = yyyymm.split('-')
        let year = Number(yearStr)
        let month = Number(monthStr)

        month += monthsToAdd
        year += Math.floor((month - 1) / 12)
        month = ((month - 1) % 12) + 1

        return `${year}-${String(month).padStart(2, '0')}`
    }
    const getLastDayOfMonth = (yyyyMm: string): string => {
        const [yearStr, monthStr] = yyyyMm.split('-')
        const lastDayDate = new Date(Number(yearStr), Number(monthStr), 0)
        const dd = String(lastDayDate.getDate()).padStart(2, '0')
        return `${dd}-${monthStr}-${yearStr}`
    }

    const handleEditToggle = () => {
        setOriginalCompany(company)
        setIsEditing(true)
    }
    const handleSave = async () => {
        if (!originalCompany) return

        const cambios = Object.entries(company).reduce((acc, [key, value]) => {
            if (JSON.stringify(value) !== JSON.stringify((originalCompany as any)[key])) {
                acc[key] = {
                    antes: (originalCompany as any)[key],
                    despues: value
                }
            }
            return acc
        }, {} as Record<string, any>)

        if (Object.keys(cambios).length > 0) {
            saveHistoricalChanges(originalCompany.id, cambios)
            await updateCompany(originalCompany.id, cambios)
        }

        setIsEditing(false)
    }
    const saveHistoricalChanges = async (companyId: string, cambios: Record<string, any>) => {
        try {
            const historicoRef = doc(db, "HistoricoList", companyId)
            const historicoSnap = await getDoc(historicoRef)

            const fecha = new Date()
            const entradaHistorial = {
                fecha: fecha.toISOString(),
                usuario: user?.email || "desconocido",
                cambios: cambios,
            }

            if (historicoSnap.exists()) {
                // Ya existe, actualizamos agregando al historial
                await updateDoc(historicoRef, {
                    historial: arrayUnion(entradaHistorial)
                })
            } else {
                // No existe, lo creamos
                await setDoc(historicoRef, {
                    empresaId: companyId,
                    historial: [entradaHistorial]
                })
            }
        } catch (error) {
            toast.error(`Error guardando en historial: ${error}`)
        }


    }
    const updateCompany = async (companyId: string, cambios: Record<string, any>) => {
        try {
            const companyRef = doc(db, "BajasList", companyId)
            const updatedFields = Object.fromEntries(
                Object.entries(cambios).map(([key, change]) => [key, change.despues])
            )

            await updateDoc(companyRef, updatedFields)
            toast.success(`Empresa Acutalicada`)
        } catch (error) {
            toast.error(`Error actualizando empresa: ${error}`)
        }
    }
    const displayHistoric = async (companyId: string) => {

        if (historicRows.length > 0) {
            setShowHistoricRows(prev => !prev)
            return
        }

        const historicoRef = doc(db, 'HistoricoList', companyId)
        const snapshot = await getDoc(historicoRef)

        if (!snapshot.exists()) {
            toast.error('No se encontraron cambios históricos para esta empresa.')
            setHistoricRows([])
            setShowHistoricRows(false)
            return
        }

        const data = snapshot.data()
        const eventos = Array.isArray(data.historial) ? data.historial : []

        if (eventos.length === 0) {
            toast.info('El historial está vacío.')
            setHistoricRows([])
            setShowHistoricRows(false)
            return
        }

        const rows: Historic[] = eventos.flatMap(evento => {
            const fecha = new Date(evento.fecha).toLocaleString()
            const usuario = evento.usuario
            const cambios = evento.cambios as Record<string, { antes: any, despues: any }>

            return Object.entries(cambios).map(([campo, { antes, despues }]) => ({
                fecha,
                usuario,
                campo,
                antes,
                despues
            }))
        })

        setHistoricRows(rows)
        setShowHistoricRows(true)
    }

    const handleDarDeAltaEmpresa = () => {
        const esValido = validateCompany(company)

        if (!esValido) {
            toast.error("Revisa los campos obligatorios del formulario.")
            return
        }
        const confirmado = window.confirm("¿Estás seguro de que quieres dar de Alta la empresa?")
        if (confirmado) {
            darDeAltaEmpresa()
        }
    }
    const validateCompany = (empresa: Empresa): boolean => {
        if (!empresa.razon_social || empresa.razon_social.trim().length < 3) {
            toast.error("La razón social debe tener al menos 3 caracteres.")
            return false
        }

        if (!Array.isArray(empresa.email) || empresa.email.length === 0) {
            toast.error("Debe incluir al menos un correo electrónico.")
            return false
        }

        if (!empresa.fecha_inicio || empresa.fecha_inicio.trim() === "") {
            toast.error("La fecha de inicio no puede estar vacía.")
            return false
        }

        if (!empresa.contacto || empresa.contacto.trim().length < 3) {
            toast.error("El nombre del contacto debe tener al menos 3 caracteres.")
            return false
        }

        if (!Array.isArray(empresa.telefono_contacto) || empresa.telefono_contacto.length === 0) {
            toast.error("Debe incluir al menos un teléfono de contacto.")
            return false
        }

        if (!empresa.titular || empresa.titular.trim().length < 3) {
            toast.error("El titular debe tener al menos 3 caracteres.")
            return false
        }

        const telefonoValido = /^[\d +]+$/.test(empresa.telefono_titular.trim())
        if (!telefonoValido) {
            toast.error("El teléfono del titular solo puede contener números, espacios o '+'.")
            return false
        }

        return true
    }
    const darDeAltaEmpresa = async () => {
        try {
            // 1. Obtener la referencia y datos de BajasList
            const bajaRef = doc(db, "BajasList", company.id);
            const bajaSnap = await getDoc(bajaRef);

            if (!bajaSnap.exists()) {
                toast.error("No se encontró la empresa en BajasList.");
                return;
            }

            const datosEmpresa = bajaSnap.data();
            // 2. Crear el documento en EmpresaList con el mismo ID
            const empresaRef = doc(db, "EmpresaList", company.id);
            await setDoc(empresaRef, {
                ...datosEmpresa,
                id: company.id
            });

            // 3. Borrar de BajasList
            await deleteDoc(bajaRef);
            // 4. Salvar el historial
            await saveHistoricalChanges(company.id, { cambios: "Empresa dada de alta desde bajas" })

            toast.success("Empresa dada de alta correctamente.");
            navigate("/home");

        } catch (error) {
            console.error("Error al dar de alta la empresa:", error);
            toast.error("Error al dar de alta la empresa.");
        }
    }
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }
    const isValidPhone = (telefono: string): boolean => {
        const digitsOnly = telefono.replace(/[^\d]/g, '') // eliminamos todo lo que no sea número
        const phoneRegex = /^[\d +]+$/
        return phoneRegex.test(telefono) && digitsOnly.length >= 9
    }

    return (<>

        <styles.GlobalDateTimeStyles />
        {showPopup && (
            <PopupText onCancel={handlePopupCancel} onSave={handlePopupSave} />
        )}

        <styles.Container justifycontent="center">
            <styles.Column>
                <styles.EntryVertical gap="3rem">
                    <styles.BackButtonStyled onClick={() => navigate("/inactive")}>
                        <FaArrowLeft />
                        Inicio
                    </styles.BackButtonStyled>
                    <styles.CompanyName>
                        {company?.razon_social || ''}
                    </styles.CompanyName>
                </styles.EntryVertical>

                <styles.EntryVertical>
                    <styles.Title>Razón Social*</styles.Title>
                    <styles.InputText
                        name='razon_social'
                        value={company?.razon_social || ''}
                        type='text'
                        placeholder='Ejm: Farogems Jewls OU'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleStringChange}>
                    </styles.InputText>
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Nombre de la persona de contacto*</styles.Title>
                    <styles.InputText
                        name='contacto'
                        value={company?.contacto || ''}
                        type='text'
                        placeholder='Ejm: Juan Pérez Solís'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleStringChange}>
                    </styles.InputText>
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>E-mail*</styles.Title>
                    <styles.EntryHorizontal>
                        <styles.InputText
                            type='text'
                            placeholder='Ejm: correo@correo.com'
                            name='email'
                            value={email}
                            disabled={!isEditing}
                            editable={isEditing}
                            onChange={handleEmailChange}
                        ></styles.InputText>
                        <styles.ButtonAddDelete
                            margin="0 0 0 0.5rem"
                            color={color.green}
                            disabled={!isEditing}
                            editable={isEditing}
                            onClick={handleAddEmail}>
                            +
                        </styles.ButtonAddDelete>
                    </styles.EntryHorizontal>
                    {Array.isArray(company.email) && company.email.length > 0 && (
                        <styles.ArrayBox editable={isEditing}>
                            {company.email.map((email, index) => (
                                <styles.ArrayItem key={index}>
                                    {email}
                                    <styles.ButtonAddDelete
                                        margin="0 0 0 0.35rem"
                                        color={color.red}
                                        disabled={!isEditing}
                                        editable={isEditing}
                                        onClick={() => handleRemoveEmail(index)}>
                                        &times;
                                    </styles.ButtonAddDelete>
                                </styles.ArrayItem>
                            ))}
                        </styles.ArrayBox>
                    )}
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Teléfonos*</styles.Title>
                    <styles.EntryHorizontal>
                        <styles.InputText
                            type='text'
                            placeholder='Ejm: 612345678'
                            width='13.5rem'
                            name='telefono_contacto'
                            value={telefono}
                            disabled={!isEditing}
                            editable={isEditing}
                            onChange={handleTelefonoChange}
                        ></styles.InputText>
                        <styles.ButtonAddDelete
                            margin="0 0 0 0.5rem"
                            color={color.green}
                            disabled={!isEditing}
                            editable={isEditing}
                            onClick={handleAddTelefono}>
                            +
                        </styles.ButtonAddDelete>
                    </styles.EntryHorizontal>
                    {Array.isArray(company.telefono_contacto) && company.telefono_contacto.length > 0 && (
                        <styles.ArrayBox editable={isEditing}>
                            {company.telefono_contacto.map((telefono, index) => (
                                <styles.ArrayItem key={index}>
                                    {telefono}
                                    <styles.ButtonAddDelete
                                        margin="0 0 0 0.35rem"
                                        color={color.red}
                                        disabled={!isEditing}
                                        editable={isEditing}
                                        onClick={() => handleRemoveTelefono(index)}>
                                        &times;
                                    </styles.ButtonAddDelete>
                                </styles.ArrayItem>
                            ))}
                        </styles.ArrayBox>
                    )}
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Fecha de inicio de contratación*</styles.Title>
                    <styles.InputText
                        name="fecha_inicio"
                        type="month"
                        width="13.5rem"
                        value={
                            company.fecha_inicio
                                ? company.fecha_inicio.slice(6, 10) + '-' + company.fecha_inicio.slice(3, 5)
                                : ''
                        }
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleFechaInicioChange}
                    />
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Modalidad contratada*</styles.Title>
                    <styles.Select
                        name="modalidad"
                        value={company?.modalidad || ''}
                        width='11.5rem'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleModalidadChange}>
                        <option>{Modalidad.trimestral}</option>
                        <option>{Modalidad.semestral}</option>
                        <option>{Modalidad.anual}</option>
                        <option>{Modalidad.myBusiness}</option>
                    </styles.Select>
                </styles.EntryVertical>
            </styles.Column>

            <styles.Column padding="11.5em 1em 1em">
                <styles.EntryVertical>
                    <styles.Title>Nombre del titular*</styles.Title>
                    <styles.InputText
                        name="titular"
                        value={company?.titular || ''}
                        type='text'
                        placeholder='Ejm: Juan Pérez Solís'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleStringChange}>
                    </styles.InputText>
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Teléfono del titular*</styles.Title>
                    <styles.InputText
                        name="telefono_titular"
                        value={company?.telefono_titular || ''}
                        type='text'
                        placeholder='Ejm: 612345678'
                        width='13.5rem'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleStringChange}></styles.InputText>
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Fecha de la última renovación*</styles.Title>
                    <styles.InputText
                        name="fecha_renovacion"
                        type="text"
                        width="13.5rem"
                        disabled={!isEditing}
                        editable={isEditing}
                        readOnly
                        value={
                            company.fecha_renovacion &&
                                company.fecha_renovacion.match(/^\d{2}-\d{2}-\d{4}$/) // Validar formato DD-MM-YYYY
                                ? (() => {
                                    const [dd, mm, yyyy] = company.fecha_renovacion.split('-')
                                    const nombreMes = nombresMeses[Number(mm) - 1]
                                    return `${nombreMes} de ${yyyy}`
                                })()
                                : 'Introducir fecha de inicio'
                        }
                    />
                </styles.EntryVertical>
                <styles.EntryVertical>
                    <styles.Title>Comentarios</styles.Title>
                    <styles.TextArea
                        name="comentarios"
                        width='20rem'
                        disabled={!isEditing}
                        editable={isEditing}
                        onChange={handleTextAreaChange}>
                    </styles.TextArea>
                </styles.EntryVertical>
                <styles.EntryHorizontal>
                    {!isEditing ? (
                        <Button
                            color={color.blue}
                            width="11rem"
                            padding="0.5em 0"
                            onClick={handleEditToggle}
                        >
                            <styles.IconModifyUser />
                            Modificar
                        </Button>
                    ) : (
                        <Button
                            color={color.green}
                            width="11rem"
                            padding="0.5em 0"
                            onClick={handleSave}
                        >
                            <styles.IconSave />
                            Guardar
                        </Button>
                    )}
                    <Button
                        color={color.green}
                        margin='0 0 0 1.5rem'
                        width="11rem"
                        padding="0.5em 0"
                        onClick={handleDarDeAltaEmpresa}>
                        <styles.IconAddUser />
                        Dar de alta
                    </Button>
                </styles.EntryHorizontal>
                <styles.EntryHorizontal>
                    <Button
                        color={color.green}
                        width="11rem"
                        padding="0.5em 0"
                        onClick={() => displayHistoric(company.id)} >
                        <styles.IconHistorical />
                        Historial
                    </Button>
                </styles.EntryHorizontal>
                <styles.EntryHorizontal>
                    <styles.CheckBox
                        type="checkbox"
                        checked={!company.renovacion}
                        disabled={!isEditing}
                        onChange={handleCheckboxChange}
                    />
                    <styles.Title>No renovar al finalizar el contrato</styles.Title>
                </styles.EntryHorizontal>
            </styles.Column>
        </styles.Container>

        {showHistoricRows && (
            <styles.TableHistoric>
                <styles.TableHead>
                    <styles.TableRow>
                        <styles.TableHeader>Fecha y hora</styles.TableHeader>
                        <styles.TableHeader>Usuario</styles.TableHeader>
                        <styles.TableHeader>Campo</styles.TableHeader>
                        <styles.TableHeader>Antes</styles.TableHeader>
                        <styles.TableHeader>Después</styles.TableHeader>
                    </styles.TableRow>
                </styles.TableHead>

                <styles.TableBody>
                    {historicRows.map((row, i) => (
                        <styles.TableRow key={i}>
                            <styles.TableCell>{row.fecha}</styles.TableCell>
                            <styles.TableCell>{row.usuario}</styles.TableCell>
                            <styles.TableCell>{row.campo}</styles.TableCell>
                            <styles.TableCell>{row.antes}</styles.TableCell>
                            <styles.TableCell>{row.despues}</styles.TableCell>
                        </styles.TableRow>
                    ))}
                </styles.TableBody>
            </styles.TableHistoric>
        )}

    </>)
}
