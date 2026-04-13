"""
VidyaRaksha — Government Scheme Recommendation Engine
Rule-based matching of student profiles to government welfare schemes.
"""
from models.database import db, Scheme, Student


# Default scheme definitions (used when DB is empty)
DEFAULT_SCHEMES = [
    {
        'scheme_name': 'Pre-Matric Scholarship',
        'ministry': 'Ministry of Education',
        'description': 'Financial support for SC/ST/OBC students from low-income families',
        'eligibility': 'Family income below ₹10,000/month, enrolled in Class 1-10',
        'benefits': '₹3,500 per year for day scholars, ₹7,000 for hostellers',
        'icon': '🎓',
        'condition_type': 'income',
        'condition_operator': '<',
        'condition_value': '10000'
    },
    {
        'scheme_name': 'Free Bicycle Scheme',
        'ministry': 'State Government',
        'description': 'Free bicycles for students living more than 3km from school',
        'eligibility': 'Distance to school > 3km, enrolled in Class 6-12',
        'benefits': 'Free bicycle + repair kit',
        'icon': '🚲',
        'condition_type': 'distance',
        'condition_operator': '>',
        'condition_value': '3'
    },
    {
        'scheme_name': 'Mid-Day Meal Programme',
        'ministry': 'Ministry of Education',
        'description': 'Free nutritious lunch to all children in government schools',
        'eligibility': 'All students enrolled in government schools',
        'benefits': 'Free nutritious meal every school day',
        'icon': '🍱',
        'condition_type': 'always',
        'condition_operator': '==',
        'condition_value': 'true'
    },
    {
        'scheme_name': 'Beti Bachao Beti Padhao',
        'ministry': 'Government of India',
        'description': 'Supports education and welfare of the girl child',
        'eligibility': 'Female students, preferably from low-income families',
        'benefits': 'Financial assistance, awareness programs, improved school infrastructure',
        'icon': '👧',
        'condition_type': 'gender',
        'condition_operator': '==',
        'condition_value': 'F'
    },
    {
        'scheme_name': 'Rashtriya Bal Swasthya Karyakram',
        'ministry': 'Ministry of Health',
        'description': 'Free health screenings and treatment for school children',
        'eligibility': 'Students with identified health issues',
        'benefits': 'Free health screening, referral to specialists, treatment',
        'icon': '🏥',
        'condition_type': 'health',
        'condition_operator': '==',
        'condition_value': '1'
    },
    {
        'scheme_name': 'Kasturba Gandhi Balika Vidyalaya',
        'ministry': 'Ministry of Education',
        'description': 'Residential schools for girls from marginalized communities',
        'eligibility': 'Female students from families with income below ₹8,000/month',
        'benefits': 'Free residential education, meals, and learning materials',
        'icon': '📚',
        'condition_type': 'gender_income',
        'condition_operator': 'composite',
        'condition_value': 'F,8000'
    },
    {
        'scheme_name': 'PM eVidya Digital Learning',
        'ministry': 'Ministry of Education',
        'description': 'Digital learning resources and online education access',
        'eligibility': 'Students without internet access',
        'benefits': 'Free tablets, DTH channels for education, offline content',
        'icon': '💻',
        'condition_type': 'internet',
        'condition_operator': '==',
        'condition_value': '0'
    },
    {
        'scheme_name': 'Samagra Shiksha Abhiyan',
        'ministry': 'Ministry of Education',
        'description': 'Holistic school improvement including transport support',
        'eligibility': 'Schools in remote areas, students with long commutes (>5km)',
        'benefits': 'Transport allowance, school infrastructure improvement',
        'icon': '🏠',
        'condition_type': 'distance',
        'condition_operator': '>',
        'condition_value': '5'
    },
    {
        'scheme_name': 'National Means-cum-Merit Scholarship',
        'ministry': 'Ministry of Education',
        'description': 'Merit-based scholarships for students from economically weaker sections',
        'eligibility': 'Family income below ₹15,000/month, exam score above 40%',
        'benefits': '₹12,000 per year for Class 9-12',
        'icon': '💰',
        'condition_type': 'income_score',
        'condition_operator': 'composite',
        'condition_value': '15000,40'
    }
]


def seed_schemes():
    """Seed the database with default government schemes"""
    if Scheme.query.count() == 0:
        for scheme_data in DEFAULT_SCHEMES:
            scheme = Scheme(**scheme_data)
            db.session.add(scheme)
        db.session.commit()


def match_schemes(features: dict, risk_level: str) -> list:
    """
    Match government schemes based on student features.
    Returns list of matched scheme dictionaries.
    """
    schemes = Scheme.query.filter_by(is_active=True).all()
    matched = []
    
    for scheme in schemes:
        if _evaluate_condition(scheme, features, risk_level):
            matched.append(scheme.to_dict())
    
    return matched


def match_schemes_for_student(student: Student) -> list:
    """Match schemes for a specific student from the database"""
    features = student.to_feature_dict()
    risk_level = student.risk_level
    return match_schemes(features, risk_level)


def _evaluate_condition(scheme: Scheme, features: dict, risk_level: str) -> bool:
    """Evaluate if a student matches a scheme's conditions"""
    ctype = scheme.condition_type
    cop = scheme.condition_operator
    cval = scheme.condition_value
    
    if not ctype or ctype == 'always':
        # Only recommend for medium/high risk students
        return risk_level in ('High', 'Medium')
    
    try:
        if ctype == 'income':
            student_val = features.get('income', 0)
            threshold = float(cval)
            return _compare(student_val, cop, threshold)
        
        elif ctype == 'distance':
            student_val = features.get('distance', 0)
            threshold = float(cval)
            return _compare(student_val, cop, threshold)
        
        elif ctype == 'gender':
            student_val = features.get('gender', 'M')
            return student_val == cval
        
        elif ctype == 'health':
            student_val = features.get('health', 0)
            threshold = int(cval)
            return student_val == threshold
        
        elif ctype == 'internet':
            student_val = features.get('internet', 1)
            threshold = int(cval)
            return student_val == threshold
        
        elif ctype == 'gender_income':
            # Composite: gender == F AND income < threshold
            parts = cval.split(',')
            return (features.get('gender', 'M') == parts[0] and 
                    features.get('income', 99999) < float(parts[1]))
        
        elif ctype == 'income_score':
            # Composite: income < threshold1 AND score > threshold2
            parts = cval.split(',')
            return (features.get('income', 99999) < float(parts[0]) and 
                    features.get('score', 0) > float(parts[1]))
        
    except (ValueError, IndexError):
        return False
    
    return False


def _compare(value, operator, threshold) -> bool:
    """Compare value against threshold using the specified operator"""
    if operator == '<':
        return value < threshold
    elif operator == '>':
        return value > threshold
    elif operator == '<=':
        return value <= threshold
    elif operator == '>=':
        return value >= threshold
    elif operator == '==':
        return value == threshold
    return False
