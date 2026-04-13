"""
VidyaRaksha — Database Seed Script
Populates the database with sample schools, students, and schemes.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
try:
    import numpy as np
    import random
    HAS_NUMPY = True
except ImportError:
    import random
    HAS_NUMPY = False
from datetime import datetime, timedelta


# Sample Indian names
MALE_NAMES = [
    'Rahul Patil', 'Rajan Kumar', 'Mohan Yadav', 'Deepak Nair', 'Arjun Singh',
    'Vikas Sharma', 'Suresh Babu', 'Amit Deshmukh', 'Sanjay Jadhav', 'Rohit Kulkarni',
    'Vishal Pawar', 'Anil Gaikwad', 'Manoj Shinde', 'Rajesh Chavan', 'Sachin More',
    'Ganesh Bhosale', 'Prasad Kale', 'Omkar Salunkhe', 'Yash Deshpande', 'Aniket Joshi',
    'Tushar Mane', 'Kiran Thorat', 'Mayur Nikam', 'Vaibhav Sutar', 'Nilesh Wagh',
    'Sagar Sonawane', 'Akash Gavhane', 'Tanmay Bhandare', 'Rushikesh Lokhande', 'Pratik Sawant'
]

FEMALE_NAMES = [
    'Priya Sharma', 'Anita Desai', 'Kavya Reddy', 'Sunita Patel', 'Meera Iyer',
    'Pooja Gupta', 'Sneha Joshi', 'Aarti Kulkarni', 'Swati Bhosale', 'Manisha Shinde',
    'Neha Pawar', 'Rani Gaikwad', 'Lata Chavan', 'Savita More', 'Rekha Jadhav',
    'Suman Kale', 'Komal Salunkhe', 'Varsha Deshpande', 'Dipali Mane', 'Ashwini Thorat',
    'Pallavi Nikam', 'Shruti Sutar', 'Gauri Wagh', 'Bhagyashri Gavhane', 'Rutuja Lokhande',
    'Sakshi Sawant', 'Ankita Bhandare', 'Tanuja Sonawane', 'Madhuri Deshmukh', 'Tejal Patil'
]

PARENT_NAMES_MALE = [
    'Ramesh', 'Sunil', 'Arun', 'Prakash', 'Dinesh', 'Vijay', 'Rajendra', 'Balaji',
    'Shankar', 'Govind', 'Sandip', 'Dattatray', 'Hanumant', 'Yashwant', 'Bhagwan'
]

PARENT_NAMES_FEMALE = [
    'Sunita', 'Asha', 'Savitri', 'Laxmi', 'Mangala', 'Sushila', 'Vandana', 'Usha',
    'Seema', 'Nirmala', 'Jayshree', 'Vaishali', 'Surekha', 'Bharati', 'Shobha'
]

SCHOOLS = [
    {'name': 'Zilla Parishad School, Nandur', 'district': 'Nashik', 'block': 'Nandgaon', 'principal': 'Mr. Rajendra Patil'},
    {'name': 'Government High School, Wadgaon', 'district': 'Pune', 'block': 'Mulshi', 'principal': 'Mrs. Sunita Kulkarni'},
    {'name': 'ZP Primary School, Khalad', 'district': 'Satara', 'block': 'Jawali', 'principal': 'Mr. Anil Jadhav'},
    {'name': 'Government Higher Secondary, Ambegaon', 'district': 'Pune', 'block': 'Ambegaon', 'principal': 'Mr. Prakash Deshmukh'},
]


def seed_database(app, db):
    """Seed the database with sample data"""
    from models.database import User, School, Student, Alert, Scheme
    from services.scheme_matcher import seed_schemes
    from ml.predict import predict_risk, get_risk_level
    
    with app.app_context():
        print("Seeding database...")
        
        # Check if already seeded
        if Student.query.count() > 0:
            print("   Database already has data. Skipping seed.")
            return
        
        # 1. Create admin user
        print("   Creating default users...")
        admin = User(
            username='admin',
            email='admin@vidyaraksha.in',
            full_name='System Administrator',
            role='admin',
            phone='9876543210'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        
        teacher = User(
            username='teacher',
            email='teacher@vidyaraksha.in',
            full_name='Priya Kulkarni',
            role='teacher',
            phone='9876543211'
        )
        teacher.set_password('teacher123')
        db.session.add(teacher)
        
        gov_officer = User(
            username='officer',
            email='officer@vidyaraksha.in',
            full_name='Rajesh Deshmukh',
            role='gov_officer',
            phone='9876543212'
        )
        gov_officer.set_password('officer123')
        db.session.add(gov_officer)
        
        db.session.flush()
        
        # 2. Create schools
        print("   Creating schools...")
        school_objs = []
        for school_data in SCHOOLS:
            school = School(
                name=school_data['name'],
                district=school_data['district'],
                block=school_data['block'],
                state='Maharashtra',
                principal_name=school_data['principal'],
                contact_phone=f'0{random.randint(20,99)}-{random.randint(2000000,9999999)}'
            )
            db.session.add(school)
            school_objs.append(school)
        
        db.session.flush()
        
        # Assign teacher to school
        teacher.school_id = school_objs[0].id
        
        # 3. Create students
        print("   Creating students...")
        if HAS_NUMPY:
            np.random.seed(42)
        random.seed(42)
        
        all_names = list(zip(MALE_NAMES, ['M'] * len(MALE_NAMES))) + \
                    list(zip(FEMALE_NAMES, ['F'] * len(FEMALE_NAMES)))
        random.shuffle(all_names)
        
        n_students = min(len(all_names), 60)
        
        for i in range(n_students):
            name, gender = all_names[i]
            school = random.choice(school_objs)
            grade = random.randint(5, 12)
            age = grade + random.randint(4, 6)
            
            # Generate realistic features
            if HAS_NUMPY:
                attendance = round(np.clip(np.random.normal(65, 20), 15, 98), 1)
                exam_score = round(np.clip(np.random.normal(50, 22), 8, 95), 1)
                distance = round(np.clip(np.random.exponential(5), 0.5, 20), 1)
                income = int(np.clip(np.random.lognormal(9.0, 0.7), 2000, 40000))
            else:
                attendance = round(min(max(random.gauss(65, 20), 15), 98), 1)
                exam_score = round(min(max(random.gauss(50, 22), 8), 95), 1)
                distance = round(min(max(random.expovariate(1/5), 0.5), 20), 1)
                income = int(min(max(random.lognormvariate(9.0, 0.7), 2000), 40000))
            parent_edu = random.choices([0, 1, 2, 3], weights=[35, 30, 25, 10])[0]
            parent_occ = random.choices([0, 1, 2, 3], weights=[30, 35, 25, 10])[0]
            health = random.choices([0, 1], weights=[75, 25])[0]
            internet = random.choices([0, 1], weights=[60, 40])[0]
            failures = random.choices([0, 1, 2, 3], weights=[50, 25, 15, 10])[0]
            transport = random.choices([0, 1], weights=[55, 45])[0]
            
            # Create parent info
            parent_name = random.choice(PARENT_NAMES_MALE if random.random() > 0.3 else PARENT_NAMES_FEMALE)
            parent_phone = f'9{random.randint(100000000, 999999999)}'
            
            student = Student(
                student_id=f'S{i+1:03d}',
                name=name,
                age=age,
                gender=gender,
                grade=grade,
                attendance_percentage=attendance,
                exam_scores=exam_score,
                previous_failures=failures,
                distance_to_school=distance,
                family_income=income,
                parent_education_level=parent_edu,
                parent_occupation=parent_occ,
                transport_availability=bool(transport),
                internet_access=bool(internet),
                health_issues=bool(health),
                parent_name=parent_name,
                parent_phone=parent_phone,
                school_id=school.id
            )
            
            # Calculate risk
            features = student.to_feature_dict()
            risk_score = predict_risk(features)
            student.dropout_risk_score = round(risk_score * 100, 1)
            student.risk_level = get_risk_level(risk_score)
            student.last_predicted_at = datetime.utcnow()
            
            db.session.add(student)
        
        db.session.flush()
        
        # Update school student counts
        for school in school_objs:
            school.total_students = Student.query.filter_by(school_id=school.id).count()
        
        # 4. Seed schemes
        print("   Creating government schemes...")
        seed_schemes()
        
        # 5. Create sample alerts
        print("   Creating sample alerts...")
        high_risk = Student.query.filter_by(risk_level='High').limit(5).all()
        for student in high_risk:
            for days_ago in [1, 3, 7]:
                alert = Alert(
                    student_id=student.id,
                    risk_level='High',
                    risk_score=student.dropout_risk_score,
                    message=f'[VidyaRaksha] Alert: {student.name} has {student.risk_level} dropout risk ({student.dropout_risk_score}%). Attendance: {student.attendance_percentage}%.',
                    recipient_type=random.choice(['teacher', 'parent', 'both']),
                    recipient_phone=student.parent_phone,
                    recipient_name=student.parent_name or 'Parent',
                    status='sent',
                    provider='simulator',
                    sent_at=datetime.utcnow() - timedelta(days=days_ago),
                    created_at=datetime.utcnow() - timedelta(days=days_ago),
                    triggered_by=admin.id
                )
                db.session.add(alert)
        
        db.session.commit()
        
        # Summary
        total = Student.query.count()
        high = Student.query.filter_by(risk_level='High').count()
        medium = Student.query.filter_by(risk_level='Medium').count()
        low = Student.query.filter_by(risk_level='Low').count()
        
        print(f"\n   Database seeded successfully!")
        print(f"   {total} students | {high} High Risk | {medium} Medium | {low} Low")
        print(f"   {len(school_objs)} schools")
        print(f"   3 users (admin/teacher123, teacher/teacher123, officer/officer123)")
        print(f"   {Scheme.query.count()} government schemes")
        print(f"   {Alert.query.count()} sample alerts")


if __name__ == '__main__':
    from app import create_app
    app = create_app()
    from models.database import db as database
    seed_database(app, database)
