import { Document, Font, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format } from 'date-fns';

Font.register({
    family: 'Manrope',
    fonts: [
        { src: '/fonts/Manrope-Regular.ttf', fontWeight: 400 },
        { src: '/fonts/Manrope-Medium.ttf', fontWeight: 500 },
        { src: '/fonts/Manrope-SemiBold.ttf', fontWeight: 600 },
        { src: '/fonts/Manrope-Bold.ttf', fontWeight: 700 },
        { src: '/fonts/Manrope-ExtraBold.ttf', fontWeight: 800 },
    ],
});

function formatTime(time: string): string {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

const STICKER_W = 281;
const STICKER_H = 104;

const SPINE_W = 12;

const styles = StyleSheet.create({
    page: {
        padding: 12,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignContent: 'flex-start',
    },
    sticker: {
        width: STICKER_W,
        height: STICKER_H,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#000000',
        borderStyle: 'solid',
        borderRadius: 0,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
    },
    spine: {
        width: SPINE_W,
        backgroundColor: '#000000',
    },
    tearLine: {
        width: 0,
        alignSelf: 'stretch',
        borderLeftWidth: 1,
        borderLeftColor: '#cbd5e1',
        borderLeftStyle: 'dashed',
    },
    body: {
        flex: 1,
        paddingVertical: 7,
        paddingHorizontal: 9,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    eyebrow: {
        fontSize: 6,
        fontFamily: 'Manrope',
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1.4,
        marginBottom: 2,
    },
    requestName: {
        fontSize: 13,
        fontFamily: 'Manrope',
        fontWeight: 700,
        color: '#0f172a',
    },
    facilityName: {
        fontSize: 11,
        fontFamily: 'Manrope',
        fontWeight: 400,
        color: '#0084ff',
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: 24,
        marginTop: 4,
    },
    metaBlock: {
        flexDirection: 'column',
        gap: 3,
    },
    metaLabel: {
        fontSize: 5.5,
        fontFamily: 'Manrope',
        fontWeight: 700,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    metaValue: {
        fontSize: 10,
        fontFamily: 'Manrope',
        fontWeight: 700,
        color: '#0f172a',
    },
});

export interface FacilityBookingEntry {
    facility_name: string;
    date: string;
    time_start: string;
    time_end: string;
    has_outsiders?: boolean;
    expected_capacity?: number | null;
}

interface Props {
    requestTitle: string;
    bookings: FacilityBookingEntry[];
}

function StubTicket({ title, booking: b }: { title: string; booking: FacilityBookingEntry }) {
    return (
        <View style={styles.sticker}>
            <View style={styles.spine} />
            <View style={styles.tearLine} />
            <View style={styles.body}>
                <View>
                    <Text style={styles.eyebrow}>GSO • Facility Stub</Text>
                    <Text style={styles.requestName}>{title}</Text>
                    <Text style={styles.facilityName}>{b.facility_name}</Text>
                </View>

                <View style={styles.dateTimeRow}>
                    <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>Date</Text>
                        <Text style={styles.metaValue}>
                            {format(new Date(b.date), 'MMM. d, yyyy')}
                        </Text>
                    </View>
                    <View style={styles.metaBlock}>
                        <Text style={styles.metaLabel}>Time</Text>
                        <Text style={styles.metaValue}>
                            {formatTime(b.time_start)} – {formatTime(b.time_end)}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

export function FacilitiesPDFDocument({ requestTitle, bookings }: Props) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {bookings.map((b, i) => (
                    <StubTicket key={i} title={requestTitle} booking={b} />
                ))}
            </Page>
        </Document>
    );
}

export async function downloadFacilitiesPDF(requestTitle: string, bookings: FacilityBookingEntry[]) {
    const blob = await pdf(
        <FacilitiesPDFDocument requestTitle={requestTitle} bookings={bookings} />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(requestTitle || 'request').replace(/\s+/g, '_')}_stickers.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}

export interface BulkFacilityBookingEntry extends FacilityBookingEntry {
    requestTitle: string;
}

interface BulkProps {
    bookings: BulkFacilityBookingEntry[];
}

export function BulkFacilitiesPDFDocument({ bookings }: BulkProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {bookings.map((b, i) => (
                    <StubTicket key={i} title={b.requestTitle} booking={b} />
                ))}
            </Page>
        </Document>
    );
}

export async function downloadBulkFacilitiesPDF(bookings: BulkFacilityBookingEntry[], filename = 'Requests-Facilities.pdf') {
    if (bookings.length === 0) {
        throw new Error('No facility bookings to export.');
    }

    const blob = await pdf(
        <BulkFacilitiesPDFDocument bookings={bookings} />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return bookings.length;
}