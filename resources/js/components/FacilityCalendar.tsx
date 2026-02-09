import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment);

const events = [
    {
        title: 'Meeting',
        start: moment("2026-2-9T11:00:00").toDate(), // Feb 10, 10:00 AM
        end: moment("2026-2-9T15:00:00").toDate(),   // Feb 10, 12:00 PM
    },
]

export default function FacilityCalendar() {
    return (
        <div style={{ height: '40rem' }}>
            <Calendar
                views={['month', 'week', 'day']}
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
            />
        </div>
    )
}
