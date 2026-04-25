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
const STICKER_H = 100;

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
        border: '2pt #454545',
        borderRadius: 4,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    requestName: {
        fontSize: 14,
        fontFamily: 'Manrope',
        fontWeight: 700,
        color: '#0f172a',
    },
    facilityName: {
        fontSize: 12,
        fontFamily: 'Manrope',
        fontWeight: 400,
        color: '#0084ff',
    },
    dateTimeRow: {
        flexDirection: 'row',
        gap: 24,
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

export function FacilitiesPDFDocument({ requestTitle, bookings }: Props) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {bookings.map((b, i) => (
                    <View key={i} style={styles.sticker}>
                        <View>
                            <Text style={styles.requestName}>{requestTitle}</Text>
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
    a.download = `${requestTitle.replace(/\s+/g, '_')}_stickers.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}